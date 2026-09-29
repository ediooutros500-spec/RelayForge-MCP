#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export RELAYFORGE_CONFIG_DIR="${RELAYFORGE_CONFIG_DIR:-$PWD/.relayforge-data}"
export RELAYFORGE_HTTP_HOST="${RELAYFORGE_HTTP_HOST:-127.0.0.1}"
export RELAYFORGE_HTTP_PORT="${RELAYFORGE_HTTP_PORT:-3334}"
export RELAYFORGE_MCP_PATH="${RELAYFORGE_MCP_PATH:-/mcp}"
export RELAYFORGE_OFFLINE_MODE="${RELAYFORGE_OFFLINE_MODE:-1}"
export RELAYFORGE_DISABLE_TELEMETRY="${RELAYFORGE_DISABLE_TELEMETRY:-1}"
export RELAYFORGE_PUBLIC_READONLY="${RELAYFORGE_PUBLIC_READONLY:-0}"

if [[ ! -d node_modules ]]; then
  npm ci
fi
npm run build

node dist/http-mcp/server.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; [[ -n "${TUNNEL_PID:-}" ]] && kill "$TUNNEL_PID" 2>/dev/null || true' EXIT INT TERM

sleep 2
echo "RelayForge MCP: http://${RELAYFORGE_HTTP_HOST}:${RELAYFORGE_HTTP_PORT}${RELAYFORGE_MCP_PATH}"

if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo 'cloudflared not found. Install it to use a fixed public tunnel.' >&2
    exit 1
  fi
  cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN" &
  TUNNEL_PID=$!
  [[ -n "${RELAYFORGE_PUBLIC_URL:-}" ]] && echo "Public MCP URL: $RELAYFORGE_PUBLIC_URL"
fi

wait "$SERVER_PID"