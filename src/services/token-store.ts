import { readFile, writeFile, mkdir, chmod, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { WHOOP_MCP_DIR, TOKENS_FILE, TOKEN_REFRESH_BUFFER_MS, WHOOP_TOKEN_URL } from '../constants.js';
import type { WhoopTokens } from '../types.js';

const DIR = join(homedir(), WHOOP_MCP_DIR);
const FILE = join(DIR, TOKENS_FILE);

// FIX 1: Mutex for concurrent refresh — only one in-flight refresh at a time
let refreshInFlight: Promise<WhoopTokens> | null = null;

async function ensureDirectory(): Promise<void> {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
}

// FIX 10: Distinguish corrupt token file from missing file
export async function loadTokens(): Promise<WhoopTokens | null> {
  try {
    const raw = await readFile(FILE, 'utf-8');
    return JSON.parse(raw) as WhoopTokens;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.error('[token-store] Failed to read tokens file:', err.message);
    }
    return null;
  }
}

// FIX 3: Atomic write via tmp+rename to prevent corruption on crash
export async function saveTokens(tokens: WhoopTokens): Promise<void> {
  await ensureDirectory();
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(tokens, null, 2), 'utf-8');
  await chmod(tmp, 0o600);
  await rename(tmp, FILE);
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

  // FIX 1: Use mutex so concurrent callers share one refresh
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(tokens.refresh_token, clientId, clientSecret)
      .then(async (t) => { await saveTokens(t); return t; })
      .finally(() => { refreshInFlight = null; });
  }
  return (await refreshInFlight).access_token;
}

export async function forceRefresh(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens?.refresh_token) {
    throw new Error(
      'Not authenticated. Run the OAuth flow first: call whoop_check_health for instructions.',
    );
  }

  // FIX 1: Use mutex so concurrent 401 retries share one refresh
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(tokens.refresh_token, clientId, clientSecret)
      .then(async (t) => { await saveTokens(t); return t; })
      .finally(() => { refreshInFlight = null; });
  }
  return (await refreshInFlight).access_token;
}
