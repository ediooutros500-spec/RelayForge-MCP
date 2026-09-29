@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-relayforge.ps1"
if errorlevel 1 (
  echo.
  echo RelayForge terminou com erro.
  pause
)
endlocal
