// WHOOP API
export const WHOOP_API_BASE = 'https://api.prod.whoop.com';
export const WHOOP_AUTH_URL = `${WHOOP_API_BASE}/oauth/oauth2/auth`;
export const WHOOP_TOKEN_URL = `${WHOOP_API_BASE}/oauth/oauth2/token`;
export const WHOOP_API_URL = `${WHOOP_API_BASE}/developer`;

// OAuth
export const OAUTH_CALLBACK_PORT = 8787;
export const OAUTH_CALLBACK_PATH = '/callback';
export const OAUTH_TIMEOUT_MS = 60_000;
export const ALL_SCOPES = [
  'offline',
  'read:profile',
  'read:recovery',
  'read:cycles',
  'read:workout',
  'read:sleep',
  'read:body_measurement',
];

// Token refresh buffer (10 minutes before expiry)
export const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000;

// Cache
export const DEFAULT_CACHE_TTL_MS = 60_000; // 1 minute
export const MIN_FETCH_INTERVAL_MS = 30_000; // 30 seconds

// Workout filtering
export const MIN_WORKOUT_DURATION_MINUTES = 19;

// Heart rate decay
export const HR_DECAY_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours
export const HR_RECENT_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Local storage
export const WHOOP_MCP_DIR = '.whoop-mcp';
export const TOKENS_FILE = 'tokens.json';
export const CACHE_FILE = 'cache.json';

// Remote client
export const REMOTE_TIMEOUT_MS = 10_000;
