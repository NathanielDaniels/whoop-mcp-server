import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { WHOOP_MCP_DIR, CACHE_FILE, DEFAULT_CACHE_TTL_MS } from '../constants.js';
import type { WhoopStats, CacheData, CacheStatus } from '../types.js';

const DIR = join(homedir(), WHOOP_MCP_DIR);
const FILE = join(DIR, CACHE_FILE);

async function loadCache(): Promise<CacheData | null> {
  try {
    const raw = await readFile(FILE, 'utf-8');
    return JSON.parse(raw) as CacheData;
  } catch {
    return null;
  }
}

async function saveCache(data: CacheData): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getCached(ttlMs = DEFAULT_CACHE_TTL_MS): Promise<WhoopStats | null> {
  const data = await loadCache();
  if (!data) return null;

  const ageMs = Date.now() - new Date(data.fetchedAt).getTime();
  if (ageMs > ttlMs) return null;

  return data.stats;
}

export async function getStale(): Promise<{ stats: WhoopStats; fetchedAt: string } | null> {
  const data = await loadCache();
  if (!data) return null;
  return { stats: data.stats, fetchedAt: data.fetchedAt };
}

export async function setCached(stats: WhoopStats): Promise<void> {
  await saveCache({ stats, fetchedAt: new Date().toISOString() });
}

export async function invalidate(): Promise<void> {
  const data = await loadCache();
  if (!data) return;
  // Set fetchedAt to epoch so it's always expired, but keep data as stale fallback
  await saveCache({ stats: data.stats, fetchedAt: new Date(0).toISOString() });
}

export async function getStatus(ttlMs = DEFAULT_CACHE_TTL_MS): Promise<CacheStatus> {
  const data = await loadCache();
  if (!data) {
    return {
      hasCachedData: false,
      fetchedAt: null,
      ageMs: null,
      ttlMs,
      ttlRemainingMs: null,
      isStale: true,
    };
  }

  const ageMs = Date.now() - new Date(data.fetchedAt).getTime();
  return {
    hasCachedData: true,
    fetchedAt: data.fetchedAt,
    ageMs,
    ttlMs,
    ttlRemainingMs: Math.max(0, ttlMs - ageMs),
    isStale: ageMs > ttlMs,
  };
}
