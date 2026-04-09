import { createServer } from 'node:http';
import { WHOOP_AUTH_URL, WHOOP_TOKEN_URL, OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH, OAUTH_TIMEOUT_MS, ALL_SCOPES } from '../constants.js';
import type { WhoopTokens } from '../types.js';

export function generateAuthUrl(clientId: string): string {
  const redirectUri = `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ALL_SCOPES.join(' '),
    state: crypto.randomUUID(),
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

export function startCallbackServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${OAUTH_CALLBACK_PORT}`);

      if (url.pathname !== OAUTH_CALLBACK_PATH) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`Authorization failed: ${error}`);
        cleanup();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        cleanup();
        reject(new Error('Missing authorization code'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>WHOOP authorized!</h2><p>You can close this tab.</p></body></html>');
      cleanup();
      resolve(code);
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('OAuth callback timed out after 60 seconds'));
    }, OAUTH_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      server.close();
    }

    server.listen(OAUTH_CALLBACK_PORT, '127.0.0.1', () => {
      // Server ready — user should now open the auth URL
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Callback server failed: ${err.message}`));
    });
  });
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<WhoopTokens> {
  const redirectUri = `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}
