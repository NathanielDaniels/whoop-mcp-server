import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { WHOOP_MCP_DIR, TOKENS_FILE, TOKEN_REFRESH_BUFFER_MS, WHOOP_TOKEN_URL } from '../constants.js';
import type { WhoopTokens } from '../types.js';

const DIR = join(homedir(), WHOOP_MCP_DIR);
const FILE = join(DIR, TOKENS_FILE);

async function ensureDirectory(): Promise<void> {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
}

export async function loadTokens(): Promise<WhoopTokens | null> {
  try {
    const raw = await readFile(FILE, 'utf-8');
    return JSON.parse(raw) as WhoopTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: WhoopTokens): Promise<void> {
  await ensureDirectory();
  await writeFile(FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  await chmod(FILE, 0o600);
}

export async function clearTokens(): Promise<void> {
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(FILE);
  } catch {
    // Already gone
  }
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<WhoopTokens> {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function getValidToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error(
      'Not authenticated. Run the OAuth flow first: call whoop_check_health for instructions.',
    );
  }

  // Token still valid (with buffer)
  if (tokens.expires_at - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
    return tokens.access_token;
  }

  // Refresh needed
  const newTokens = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
  await saveTokens(newTokens);
  return newTokens.access_token;
}
