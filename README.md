# WHOOP MCP Server

MCP server for WHOOP biometric data. Query recovery, strain, sleep, workouts, and heart rate from any MCP-compatible AI client.

## Two Modes

- **Remote** — Calls `/api/whoop/stats` on a deployed WHOOP-connected site (e.g., patrickwingert.com)
- **Direct** — Talks to the WHOOP API directly with local OAuth + token storage

Both modes expose the same 11 tools through a shared interface.

## Setup

### 1. Build

```bash
npm install
npm run build
```

### 2. Configure Claude Code

**Remote mode** (uses an existing WHOOP-connected site):

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/path/to/whoop-mcp-server/dist/index.js"],
      "env": {
        "WHOOP_MODE": "remote",
        "WHOOP_BASE_URL": "https://patrickwingert.com"
      }
    }
  }
}
```

**Direct mode** (standalone, talks to WHOOP API):

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/path/to/whoop-mcp-server/dist/index.js"],
      "env": {
        "WHOOP_MODE": "direct",
        "WHOOP_CLIENT_ID": "your-client-id",
        "WHOOP_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### 3. Direct Mode — WHOOP Developer Setup

1. Go to [WHOOP Developer Portal](https://app.whoop.com/developer)
2. Create a new application
3. Set redirect URI to `http://localhost:8787/callback`
4. Enable scopes: `read:profile`, `read:recovery`, `read:cycles`, `read:workout`, `read:sleep`, `read:body_measurement`
5. Copy Client ID and Client Secret to your config

### 4. Direct Mode — OAuth Flow

On first use, the server will need OAuth tokens. The OAuth flow:

1. Server starts a temporary listener on `localhost:8787`
2. Open the generated authorization URL in your browser
3. Authorize on WHOOP's site
4. Tokens are stored in `~/.whoop-mcp/tokens.json` (chmod 600)
5. Tokens auto-refresh going forward

## Tools

### Tier 1 — Biometric Data (read-only)

| Tool | Description |
|------|-------------|
| `whoop_get_stats` | Full biometric snapshot (recovery, strain, HR, sleep, workout) |
| `whoop_get_recovery` | Recovery score (0-100), resting HR, HRV, SpO2, skin temp |
| `whoop_get_strain` | Daily strain (0-21), kilojoules, average/max HR |
| `whoop_get_workout` | Latest workout: sport, duration, strain, HR zones, distance |
| `whoop_get_heart_rate` | Current HR with source context (resting/workout/decay) |
| `whoop_get_sleep` | Sleep performance, stages, efficiency, respiratory rate |
| `whoop_get_sleep_need` | Sleep need breakdown: baseline, debt, strain impact, nap offset |

### Tier 2 — Diagnostics

| Tool | Description |
|------|-------------|
| `whoop_check_health` | Endpoint status, token expiry, connection state |
| `whoop_get_cache_status` | What's cached, staleness, TTL remaining |
| `whoop_invalidate_cache` | Force fresh data on next request |
| `whoop_get_config` | Current mode, target, scopes, cache TTL |

All tools support `response_format`: `markdown` (default, human-readable) or `json` (structured data).

## Environment Variables

| Variable | Mode | Required | Description |
|----------|------|----------|-------------|
| `WHOOP_MODE` | Both | Yes | `remote` or `direct` |
| `WHOOP_BASE_URL` | Remote | Yes | Base URL of WHOOP-connected app |
| `WHOOP_CLIENT_ID` | Direct | Yes | From WHOOP developer dashboard |
| `WHOOP_CLIENT_SECRET` | Direct | Yes | From WHOOP developer dashboard |

## Local Storage (Direct Mode)

```
~/.whoop-mcp/
├── tokens.json      # OAuth tokens (chmod 600)
└── cache.json       # Cached API responses
```

## Testing

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```
