# RelayForge MCP

RelayForge MCP is a portable Model Context Protocol (MCP) server that gives compatible AI clients a controlled bridge to local files, processes, search, and document utilities.

It supports **MCP Streamable HTTP**, so it can be connected to web-based AI clients that accept a remote MCP URL, as well as local MCP clients.


## What it provides

RelayForge exposes tools for:

- Reading, writing, moving, and inspecting files
- Editing text blocks
- Directory creation and listing
- File/content search with progressive results
- Starting and interacting with terminal processes
- Listing and terminating processes
- PDF creation and manipulation
- Excel, DOCX, image, and text handling
- Configuration and local tool history

The default HTTP endpoint is:

```text
http://127.0.0.1:3334/mcp
```

## Requirements

- Node.js 18 or newer
- npm
- Git
- Windows, macOS, or Linux

For a **fixed public HTTPS URL**, you also need a reverse proxy or tunnel provider. The included launcher supports a Cloudflare Named Tunnel when `cloudflared` is installed.

## Quick start

Clone the repository:

```bash
git clone https://github.com/ediooutros500-spec/RelayForge-MCP.git
cd RelayForge-MCP
npm ci
npm run build
```

### Windows

Double-click:

```text
start-relayforge.bat
```

Or run:

```powershell
.\start-relayforge.bat
```

### Linux / macOS

```bash
chmod +x start-relayforge.sh
./start-relayforge.sh
```

## Connect an AI client

In any AI client that supports remote MCP over Streamable HTTP, add an MCP server using:

```text
Name: RelayForge MCP
Transport: Streamable HTTP
URL: http://127.0.0.1:3334/mcp
```

A browser-hosted AI service usually cannot reach your computer's `127.0.0.1`. In that case, expose RelayForge through HTTPS and register the resulting public URL instead.

Examples of compatible client types include:

- Web AI products with custom MCP server support
- Desktop AI clients with MCP support
- IDE agents that accept MCP servers
- Custom applications using the MCP SDK

The exact UI varies by product, but the URL always points to the RelayForge `/mcp` endpoint.
## Fixed public URL

Quick tunnels create a new URL each time. For a stable URL, use a named tunnel or your own reverse proxy.

RelayForge's Windows launcher supports a Cloudflare Named Tunnel.

1. Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

2. Configure a permanent hostname in your Cloudflare Tunnel dashboard, for example:

```text
mcp.example.com -> http://127.0.0.1:3334
```

3. Put only the local secrets in `.env`:

```dotenv
RELAYFORGE_PUBLIC_URL=https://mcp.example.com/mcp
CLOUDFLARE_TUNNEL_TOKEN=your_named_tunnel_token
```

4. Start RelayForge:

```text
start-relayforge.bat
```

The launcher will start the local MCP server, start the named tunnel, and print the fixed public MCP URL.

**Never commit `.env`, tunnel tokens, API keys, passwords, or private certificates.**

You can use another HTTPS reverse proxy instead of Cloudflare. Point it to:

```text
http://127.0.0.1:3334/mcp
```

## Authentication

RelayForge supports an optional Bearer token on the HTTP endpoint.

Set:

```dotenv
RELAYFORGE_HTTP_TOKEN=use-a-long-random-secret
```

Then configure your MCP client to send:

```http
Authorization: Bearer use-a-long-random-secret
```

When RelayForge binds to a non-loopback address, a token is required.

For public deployments, use HTTPS plus authentication. A secret URL path alone should not be treated as strong authentication.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `RELAYFORGE_HTTP_HOST` | `127.0.0.1` | HTTP bind address |
| `RELAYFORGE_HTTP_PORT` | `3334` | HTTP port |
| `RELAYFORGE_MCP_PATH` | `/mcp` | MCP endpoint path |
| `RELAYFORGE_HTTP_TOKEN` | empty | Optional Bearer token |
| `RELAYFORGE_CONFIG_DIR` | `~/.relayforge` | Local runtime configuration |
| `RELAYFORGE_OFFLINE_MODE` | `1` in launchers | Disables background network feature-flag fetches |
| `RELAYFORGE_DISABLE_TELEMETRY` | `1` in launchers | Disables inherited telemetry |
| `RELAYFORGE_PUBLIC_READONLY` | `0` | Restrict exposed tools to read-only subset |
| `RELAYFORGE_PUBLIC_URL` | empty | Fixed public URL shown by launcher |
| `CLOUDFLARE_TUNNEL_TOKEN` | empty | Optional named-tunnel token, stored locally only |

Legacy `DC_*` environment variables remain supported internally for compatibility with the upstream codebase, but new deployments should use `RELAYFORGE_*`.
## Security model

RelayForge can execute commands and modify files when full tools are enabled. Treat access to the MCP endpoint like access to your computer.

Recommended practices:

1. Bind locally to `127.0.0.1` unless remote access is required.
2. Use HTTPS for any remote connection.
3. Set `RELAYFORGE_HTTP_TOKEN` for public endpoints.
4. Keep `.env` outside version control.
5. Restrict `allowedDirectories` in the RelayForge configuration when full filesystem access is unnecessary.
6. Keep the inherited blocked-command list enabled.
7. Use `RELAYFORGE_PUBLIC_READONLY=1` for low-risk remote testing.
8. Rotate tunnel tokens immediately if they are ever exposed.

An empty `allowedDirectories` array means filesystem access is unrestricted by that setting.

## Local-only mode

If you do not need a web AI to connect over the internet, no tunnel is required:

```bash
npm run start:http
```

The MCP endpoint will be:

```text
http://127.0.0.1:3334/mcp
```

## npm scripts

```text
npm run build         Compile TypeScript
npm run start:http    Start MCP Streamable HTTP server
npm run start:local   Start the lightweight local gateway
npm test              Run the upstream-compatible test suite
npm run inspector     Open the MCP Inspector against the stdio server
```

## Architecture

```text
AI client
   |
   | MCP Streamable HTTP
   v
RelayForge HTTP transport
   |
   v
RelayForge MCP server
   |
   +-- filesystem tools
   +-- search tools
   +-- process / terminal tools
   +-- document tools
   +-- configuration / history
```

RelayForge currently contains no Supabase transport or Supabase runtime dependency. Remote access is provided through standard MCP Streamable HTTP plus whichever HTTPS reverse proxy or tunnel you choose. A separate authenticated relay layer can be added later without changing the MCP tool layer.

## Building from source

```bash
npm ci
npm run build
```

Node 18+ is required. Node 20 or 22 LTS is recommended.

After the build, the Streamable HTTP entry point is:

```text
dist/http-mcp/server.js
```

## Verify with an MCP client

Use the MCP Inspector or another MCP client against:

```text
http://127.0.0.1:3334/mcp
```

A successful connection should discover the available RelayForge tools and allow `tools/list` and `tools/call`.

## Repository secrets policy

This repository intentionally excludes:

- `.env`
- `.env.local`
- `.relayforge-data/`
- `.educational-data/`
- tunnel logs
- downloaded tunnel binaries
- API keys and access tokens
- local device/session files

Use `.env.example` only as a template.
