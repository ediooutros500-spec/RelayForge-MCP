import http, { IncomingMessage, ServerResponse } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { server } from '../server.js';
import { configManager } from '../config-manager.js';
import { featureFlagManager } from '../utils/feature-flags.js';

const HOST = process.env.RELAYFORGE_HTTP_HOST || process.env.MCP_HTTP_HOST || '127.0.0.1';
const PORT = Number(process.env.RELAYFORGE_HTTP_PORT || process.env.MCP_HTTP_PORT || '3334');
const TOKEN = process.env.RELAYFORGE_HTTP_TOKEN || process.env.MCP_HTTP_TOKEN || '';
const MCP_PATH = process.env.RELAYFORGE_MCP_PATH || process.env.MCP_HTTP_PATH || '/mcp';

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage): boolean {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

async function main() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('RELAYFORGE_HTTP_PORT must be a valid TCP port');
  }
  if (!isLoopback(HOST) && !TOKEN) {
    throw new Error('RELAYFORGE_HTTP_TOKEN is required when binding outside localhost');
  }

  (global as any).disableOnboarding = true;
  // The original logger expects a stdio transport. In HTTP mode we keep
  // protocol logs quiet instead of writing JSON-RPC notifications to stdout.
  (global as any).mcpTransport = {
    sendLog: () => undefined,
    configureForClient: () => undefined,
    enableNotifications: () => undefined
  };

  await configManager.loadConfig();
  await featureFlagManager.initialize();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  await server.connect(transport);

  const httpServer = http.createServer(async (req, res) => {
    try {
      if (req.url === '/health') {
        return json(res, 200, {
          ok: true,
          protocol: 'mcp-streamable-http',
          host: HOST,
          port: PORT
        });
      }

      if (req.url !== MCP_PATH) {
        return json(res, 404, { ok: false, error: 'Not found' });
      }

      if (!authorized(req)) {
        return json(res, 401, { ok: false, error: 'Unauthorized' });
      }

      await transport.handleRequest(req, res);
    } catch (error) {
      if (!res.headersSent) {
        const message = error instanceof Error ? error.message : String(error);
        json(res, 500, { ok: false, error: message });
      } else {
        res.end();
      }
    }
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`[relayforge] listening on http://${HOST}:${PORT}${MCP_PATH}`);
    console.log('[relayforge] transport: MCP Streamable HTTP');
    console.log(`[relayforge] auth token: ${TOKEN ? 'enabled' : 'disabled (localhost only)'}`);
  });

  const shutdown = async () => {
    console.log('\n[mcp-http] shutting down...');
    httpServer.close();
    try {
      await transport.close();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('[mcp-http] fatal:', error);
  process.exit(1);
});
