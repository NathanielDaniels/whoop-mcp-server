#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RemoteClient } from './services/remote-client.js';
import { DirectClient } from './services/direct-client.js';
import type { WhoopClient } from './services/client.js';
import { registerBiometricTools } from './tools/biometrics.js';
import { registerHistoryTools } from './tools/history.js';
import { registerDiagnosticTools } from './tools/diagnostics.js';

// All logging to stderr (stdout is reserved for MCP stdio transport)
const log = (...args: unknown[]) => console.error('[whoop-mcp]', ...args);

function createClient(): WhoopClient {
  const mode = process.env.WHOOP_MODE || 'remote';

  if (mode === 'remote') {
    const baseUrl = process.env.WHOOP_BASE_URL;
    if (!baseUrl) {
      log('ERROR: WHOOP_MODE=remote requires WHOOP_BASE_URL');
      process.exit(1);
    }
    log(`Remote mode → ${baseUrl}`);
    return new RemoteClient(baseUrl);
  }

  if (mode === 'direct') {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      log('ERROR: WHOOP_MODE=direct requires WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET');
      process.exit(1);
    }
    log('Direct mode → WHOOP API');
    return new DirectClient(clientId, clientSecret);
  }

  log(`ERROR: Unknown WHOOP_MODE="${mode}". Use "remote" or "direct".`);
  process.exit(1);
}

async function main() {
  const client = createClient();

  const server = new McpServer({
    name: 'whoop',
    version: '1.0.0',
  });

  registerBiometricTools(server, client);
  registerHistoryTools(server, client);
  registerDiagnosticTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Server started. 16 tools registered.');
}

main().catch((err) => {
  log('Fatal error:', err);
  process.exit(1);
});
