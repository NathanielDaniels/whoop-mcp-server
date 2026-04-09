import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WhoopClient } from '../services/client.js';
import {
  checkHealthInput,
  getCacheStatusInput,
  invalidateCacheInput,
  getConfigInput,
} from '../schemas/inputs.js';

export function registerDiagnosticTools(server: McpServer, client: WhoopClient): void {
  // ── whoop_authorize ────────────────────────────
  server.tool(
    'whoop_authorize',
    'Start OAuth flow to connect a WHOOP account. Returns an authorization URL to open in your browser. Direct mode only.',
    {},
    async () => {
      try {
        const { authUrl, waitForCallback } = await client.authorize();

        // Start listening for the callback in the background
        const callbackPromise = waitForCallback().then(() => {
          console.error('[whoop-mcp] OAuth complete — tokens saved.');
        }).catch((err) => {
          console.error('[whoop-mcp] OAuth failed:', err.message);
        });

        // Don't await — return the URL immediately so the user can open it
        void callbackPromise;

        return {
          content: [{
            type: 'text',
            text: [
              '# WHOOP Authorization',
              '',
              'Open this URL in your browser to authorize:',
              '',
              authUrl,
              '',
              'After authorizing on WHOOP\'s site, you\'ll be redirected to localhost:8787.',
              'The server is listening and will capture the tokens automatically.',
              'This listener will timeout after 60 seconds.',
            ].join('\n'),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: 'text', text: e.message }] };
      }
    },
  );

  // ── whoop_check_health ─────────────────────────
  server.tool(
    'whoop_check_health',
    'Connection and endpoint health: status per endpoint, token expiry, connection state',
    checkHealthInput.shape,
    async ({ response_format }) => {
      const health = await client.checkHealth();

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(health, null, 2) }] };
      }

      const lines = [
        `# WHOOP Health Check`,
        `- **Mode:** ${health.mode}`,
        `- **Connected:** ${health.connected ? 'Yes' : 'No'}`,
        `- **All Healthy:** ${health.allHealthy ? 'Yes' : 'No'}`,
      ];

      if (health.tokenExpiry) {
        const expiresAt = new Date(health.tokenExpiry);
        const remainingMs = expiresAt.getTime() - Date.now();
        const remainingMin = Math.round(remainingMs / 60_000);
        lines.push(`- **Token Expires:** ${health.tokenExpiry} (${remainingMin > 0 ? `${remainingMin}m remaining` : 'EXPIRED'})`);
      }

      lines.push('', '## Endpoints');
      for (const [name, status] of Object.entries(health.endpoints)) {
        const icon = status.ok ? 'OK' : 'FAIL';
        lines.push(`- **${name}:** ${status.status} ${icon}`);
      }

      if (!health.connected && health.mode === 'direct') {
        lines.push(
          '',
          '## Setup Required',
          'No tokens found. To authenticate:',
          '1. Ensure WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET are set',
          '2. Run the OAuth flow to connect your WHOOP account',
        );
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── whoop_get_cache_status ─────────────────────
  server.tool(
    'whoop_get_cache_status',
    'Cache freshness: cached data status, age, TTL remaining',
    getCacheStatusInput.shape,
    async ({ response_format }) => {
      const status = await client.getCacheStatus();

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      }

      const lines = [
        `# Cache Status`,
        `- **Has Cached Data:** ${status.hasCachedData ? 'Yes' : 'No'}`,
        `- **Fetched At:** ${status.fetchedAt || 'N/A'}`,
      ];

      if (status.ageMs !== null) {
        const ageSec = Math.round(status.ageMs / 1000);
        lines.push(`- **Age:** ${ageSec}s`);
      }

      lines.push(`- **TTL:** ${Math.round(status.ttlMs / 1000)}s`);

      if (status.ttlRemainingMs !== null) {
        lines.push(`- **TTL Remaining:** ${Math.round(status.ttlRemainingMs / 1000)}s`);
      }

      lines.push(`- **Stale:** ${status.isStale ? 'Yes' : 'No'}`);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── whoop_invalidate_cache ─────────────────────
  server.tool(
    'whoop_invalidate_cache',
    'Force fresh data on next request by invalidating the cache',
    invalidateCacheInput.shape,
    async () => {
      await client.invalidateCache();
      return {
        content: [{ type: 'text', text: 'Cache invalidated. Next data request will fetch fresh from the API.' }],
      };
    },
  );

  // ── whoop_get_config ───────────────────────────
  server.tool(
    'whoop_get_config',
    'Server configuration: mode, base URL or API target, enabled scopes, cache TTL',
    getConfigInput.shape,
    async ({ response_format }) => {
      const config = client.getConfig();

      if (response_format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
      }

      const lines = [
        `# WHOOP MCP Config`,
        `- **Mode:** ${config.mode}`,
      ];

      if (config.baseUrl) lines.push(`- **Base URL:** ${config.baseUrl}`);
      if (config.apiTarget) lines.push(`- **API Target:** ${config.apiTarget}`);
      if (config.scopes) lines.push(`- **Scopes:** ${config.scopes.join(', ')}`);
      lines.push(`- **Cache TTL:** ${Math.round(config.cacheTtlMs / 1000)}s`);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
