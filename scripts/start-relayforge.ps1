param([string]$Root = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
Set-Location $Root

function Import-DotEnv([string]$Path) {
  if (!(Test-Path $Path)) { return }
  foreach ($line in Get-Content $Path) {
    $trim = $line.Trim()
    if (!$trim -or $trim.StartsWith('#') -or !$trim.Contains('=')) { continue }
    $parts = $trim.Split('=', 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name -and !(Test-Path "Env:$name")) { Set-Item -Path "Env:$name" -Value $value }
  }
}

function Get-CloudflaredPath {
  $installed = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($installed) { return $installed.Source }

  $toolsDir = Join-Path $Root '.tools'
  $portable = Join-Path $toolsDir 'cloudflared.exe'
  if (Test-Path $portable) { return $portable }

  Write-Host '[SETUP] cloudflared nao encontrado. Baixando versao portatil oficial...'
  New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
  $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  & curl.exe -L --fail --silent --show-error $url -o $portable
  if ($LASTEXITCODE -ne 0 -or !(Test-Path $portable)) {
    throw 'Falha ao baixar cloudflared.'
  }

  $signature = Get-AuthenticodeSignature $portable
  if ($signature.Status -ne 'Valid') {
    Remove-Item $portable -Force -ErrorAction SilentlyContinue
    throw "Assinatura do cloudflared invalida: $($signature.Status)"
  }
  Write-Host '[SETUP] cloudflared instalado em .tools\cloudflared.exe'
  return $portable
}

Import-DotEnv (Join-Path $Root '.env')

$env:RELAYFORGE_CONFIG_DIR = if ($env:RELAYFORGE_CONFIG_DIR) { $env:RELAYFORGE_CONFIG_DIR } else { Join-Path $Root '.relayforge-data' }
$env:RELAYFORGE_HTTP_HOST = if ($env:RELAYFORGE_HTTP_HOST) { $env:RELAYFORGE_HTTP_HOST } else { '127.0.0.1' }
$env:RELAYFORGE_HTTP_PORT = if ($env:RELAYFORGE_HTTP_PORT) { $env:RELAYFORGE_HTTP_PORT } else { '3334' }
$env:RELAYFORGE_MCP_PATH = if ($env:RELAYFORGE_MCP_PATH) { $env:RELAYFORGE_MCP_PATH } else { '/mcp' }
$env:RELAYFORGE_OFFLINE_MODE = if ($env:RELAYFORGE_OFFLINE_MODE) { $env:RELAYFORGE_OFFLINE_MODE } else { '1' }
$env:RELAYFORGE_DISABLE_TELEMETRY = if ($env:RELAYFORGE_DISABLE_TELEMETRY) { $env:RELAYFORGE_DISABLE_TELEMETRY } else { '1' }
$env:RELAYFORGE_PUBLIC_READONLY = if ($env:RELAYFORGE_PUBLIC_READONLY) { $env:RELAYFORGE_PUBLIC_READONLY } else { '0' }

if (!(Test-Path 'node_modules')) {
  Write-Host '[SETUP] Instalando dependencias...'
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci falhou.' }
}

Write-Host '[BUILD] Compilando RelayForge MCP...'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build falhou.' }

$localUrl = "http://$($env:RELAYFORGE_HTTP_HOST):$($env:RELAYFORGE_HTTP_PORT)$($env:RELAYFORGE_MCP_PATH)"
Write-Host ''
Write-Host '============================================'
Write-Host ' RELAYFORGE MCP'
Write-Host '============================================'
Write-Host "[LOCAL] $localUrl"
Write-Host '[MCP] Streamable HTTP'
Write-Host "[READ ONLY] $($env:RELAYFORGE_PUBLIC_READONLY)"
Write-Host ''

$server = $null
$tunnel = $null
try {
  $server = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('dist/http-mcp/server.js') -WorkingDirectory $Root -PassThru -NoNewWindow
  Start-Sleep -Seconds 2
  if ($server.HasExited) { throw "Servidor MCP encerrou com codigo $($server.ExitCode)." }

  if ($env:CLOUDFLARE_TUNNEL_TOKEN) {
    $cloudflaredPath = Get-CloudflaredPath
    Write-Host "[TUNNEL] cloudflared: $cloudflaredPath"
    Write-Host '[TUNNEL] Iniciando Cloudflare Named Tunnel...'
    $tunnel = Start-Process -FilePath $cloudflaredPath -ArgumentList @('tunnel','run','--token',$env:CLOUDFLARE_TUNNEL_TOKEN) -WorkingDirectory $Root -PassThru -NoNewWindow
    Start-Sleep -Seconds 3
    if ($tunnel.HasExited) { throw "Cloudflare Tunnel encerrou com codigo $($tunnel.ExitCode)." }

    if ($env:RELAYFORGE_PUBLIC_URL) {
      Write-Host ''
      Write-Host '============================================' -ForegroundColor Green
      Write-Host ' URL MCP PUBLICA FIXA' -ForegroundColor Green
      Write-Host '============================================' -ForegroundColor Green
      Write-Host $env:RELAYFORGE_PUBLIC_URL -ForegroundColor Cyan
      Write-Host '============================================' -ForegroundColor Green
    } else {
      Write-Host '[AVISO] Tunnel conectado, mas RELAYFORGE_PUBLIC_URL nao esta definido no .env.'
    }
  } else {
    Write-Host '[TUNNEL] Desativado. Defina CLOUDFLARE_TUNNEL_TOKEN no .env para URL publica fixa.'
  }

  Write-Host ''
  Write-Host 'Mantenha esta janela aberta.'
  Write-Host 'Pressione ENTER para encerrar.'
  [void](Read-Host)
}
finally {
  if ($tunnel -and !$tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
  if ($server -and !$server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}