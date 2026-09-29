import http, { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = process.env.LOCAL_GATEWAY_HOST || '127.0.0.1';
const PORT = Number(process.env.LOCAL_GATEWAY_PORT || '3333');
const TOKEN = process.env.LOCAL_GATEWAY_TOKEN || '';
const MAX_BODY_BYTES = 1024 * 1024;

let client: Client | null = null;
let transport: StdioClientTransport | null = null;

function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (!origin) return;
  const allowed = new Set(
    (process.env.LOCAL_GATEWAY_ALLOWED_ORIGINS ||
      'http://127.0.0.1,http://localhost,http://127.0.0.1:3000,http://localhost:3000')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );

  if (allowed.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  }
}

function authorized(req: IncomingMessage): boolean {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
async function connectLocalMcp() {
  const mcpEntry = path.resolve(__dirname, '../index.js');
  const extraEnv: Record<string, string> = {};

  for (const key of ['DC_CONFIG_DIR', 'DC_DEVICE_CONFIG_DIR', 'DC_DEVICE_CONFIG_PATH']) {
    const value = process.env[key];
    if (value) extraEnv[key] = value;
  }

  transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpEntry, '--no-onboarding'],
    cwd: path.dirname(mcpEntry),
    env: { ...getDefaultEnvironment(), ...extraEnv }
  });

  client = new Client(
    { name: 'relayforge-local-gateway', version: '0.1.0' },
    { capabilities: {} }
  );

  client.onclose = () => {
    console.error('[local-gateway] MCP child disconnected');
    client = null;
    transport = null;
  };

  await client.connect(transport);
}

async function ensureClient(): Promise<Client> {
  if (!client) await connectLocalMcp();
  if (!client) throw new Error('MCP client unavailable');
  return client;
}
async function handler(req: IncomingMessage, res: ServerResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (!authorized(req)) {
    return json(res, 401, { ok: false, error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, {
        ok: true,
        mode: 'local',
        host: HOST,
        port: PORT,
        mcpConnected: Boolean(client)
      });
    }

    if (req.method === 'GET' && req.url === '/tools') {
      const mcp = await ensureClient();
      const result = await mcp.listTools();
      return json(res, 200, { ok: true, ...result });
    }

    if (req.method === 'POST' && req.url === '/call') {
      const body = await readJson(req);
      if (!body || typeof body.name !== 'string') {
        return json(res, 400, { ok: false, error: 'Field "name" is required' });
      }
      const mcp = await ensureClient();
      const result = await mcp.callTool({
        name: body.name,
        arguments: body.arguments || {}
      });

      return json(res, 200, { ok: true, result });
    }

    return json(res, 404, {
      ok: false,
      error: 'Not found',
      routes: ['GET /health', 'GET /tools', 'POST /call']
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(res, 500, { ok: false, error: message });
  }
}

async function shutdown() {
  console.log('\n[local-gateway] shutting down...');
  try {
    await transport?.close();
  } finally {
    process.exit(0);
  }
}

async function main() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('LOCAL_GATEWAY_PORT must be a valid TCP port');
  }
  if (!isLoopback(HOST) && !TOKEN) {
    throw new Error('LOCAL_GATEWAY_TOKEN is required when binding outside localhost');
  }

  await connectLocalMcp();

  const server = http.createServer((req, res) => void handler(req, res));
  server.listen(PORT, HOST, () => {
    console.log(`[local-gateway] http://${HOST}:${PORT}`);
    console.log(`[local-gateway] auth token: ${TOKEN ? 'enabled' : 'disabled (localhost only)'}`);
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('[local-gateway] fatal:', error);
  process.exit(1);
});
