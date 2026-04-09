import type { WhoopClient } from './client.js';
import type {
  WhoopRecovery,
  WhoopCycle,
  WhoopWorkout,
  WhoopSleep,
  WhoopSleepNeeded,
  WhoopStats,
  HeartRateInfo,
  HealthReport,
  CacheStatus,
  ServerConfig,
  EndpointHealth,
} from '../types.js';
import {
  WHOOP_API_URL,
  ALL_SCOPES,
  DEFAULT_CACHE_TTL_MS,
  MIN_WORKOUT_DURATION_MINUTES,
  HR_DECAY_PERIOD_MS,
  HR_RECENT_THRESHOLD_MS,
} from '../constants.js';
import { getValidToken, loadTokens, saveTokens, forceRefresh } from './token-store.js';
import { generateAuthUrl, startCallbackServer, exchangeCode } from './oauth.js';
import * as cache from './cache.js';

export class DirectClient implements WhoopClient {
  private clientId: string;
  private clientSecret: string;
  private cacheTtlMs: number;

  constructor(clientId: string, clientSecret: string, cacheTtlMs = DEFAULT_CACHE_TTL_MS) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.cacheTtlMs = cacheTtlMs;
  }

  private async getToken(): Promise<string> {
    return getValidToken(this.clientId, this.clientSecret);
  }

  private async whoopFetch<T>(endpoint: string, isRetry = false): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${WHOOP_API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // FIX 7: Retry once with exponential backoff on 429
    if (response.status === 429) {
      if (!isRetry) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '2', 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return this.whoopFetch<T>(endpoint, true);
      }
      throw new Error('Rate limited by WHOOP API after retry');
    }

    if (response.status === 401) {
      if (!isRetry) {
        // Token expired between getValidToken check and the API call, or
        // the stored token was stale. Force a refresh and retry once.
        try {
          await forceRefresh(this.clientId, this.clientSecret);
          return this.whoopFetch<T>(endpoint, true);
        } catch (refreshErr: any) {
          // FIX 6: Log refresh failure instead of silently swallowing
          console.error('[direct] Token refresh failed:', refreshErr.message);
        }
      }
      throw new Error('WHOOP_UNAUTHORIZED');
    }

    if (response.status === 403) {
      throw new Error('WHOOP_SCOPE_MISSING');
    }

    // FIX 4: Sanitize error — log full body to stderr, throw status only
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[direct] WHOOP API error ${response.status}:`, errorBody);
      throw new Error(`WHOOP API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // ── Data Fetching ──────────────────────────────

  private async fetchRecovery(): Promise<WhoopRecovery | null> {
    try {
      const response = await this.whoopFetch<{ records: WhoopRecovery[] }>(
        '/v2/recovery?limit=3&order=descending',
      );
      return response.records[0] || null;
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return null;
      if (e.message === 'WHOOP_UNAUTHORIZED') throw e;
      console.error('[direct] Recovery fetch error:', e.message);
      return null;
    }
  }

  private async fetchCycle(): Promise<WhoopCycle | null> {
    try {
      const response = await this.whoopFetch<{ records: WhoopCycle[] }>(
        '/v2/cycle?limit=1&order=descending',
      );
      return response.records[0] || null;
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return null;
      if (e.message === 'WHOOP_UNAUTHORIZED') throw e;
      console.error('[direct] Cycle fetch error:', e.message);
      return null;
    }
  }

  private async fetchSleep(): Promise<WhoopSleep | null> {
    try {
      const response = await this.whoopFetch<{ records: WhoopSleep[] }>(
        '/v2/activity/sleep?limit=1&order=descending',
      );
      return response.records[0] || null;
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return null;
      if (e.message === 'WHOOP_UNAUTHORIZED') throw e;
      console.error('[direct] Sleep fetch error:', e.message);
      return null;
    }
  }

  private async fetchWorkout(): Promise<WhoopWorkout | null> {
    try {
      const response = await this.whoopFetch<{ records: WhoopWorkout[] }>(
        '/v2/activity/workout?limit=5&order=descending',
      );

      if (!response.records?.length) return null;

      // Find first workout meeting minimum duration
      for (const workout of response.records) {
        if (!workout.start || !workout.end) continue;
        const durationMs = new Date(workout.end).getTime() - new Date(workout.start).getTime();
        if (durationMs / 60_000 >= MIN_WORKOUT_DURATION_MINUTES) {
          return workout;
        }
      }

      // All short — return most recent anyway
      return response.records[0] || null;
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return null;
      if (e.message === 'WHOOP_UNAUTHORIZED') throw e;
      console.error('[direct] Workout fetch error:', e.message);
      return null;
    }
  }

  // ── History Fetching ────────────────────────────

  async getRecoveryHistory(limit: number): Promise<WhoopRecovery[]> {
    try {
      const response = await this.whoopFetch<{ records: WhoopRecovery[] }>(
        `/v2/recovery?limit=${limit}&order=descending`,
      );
      return response.records || [];
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return [];
      throw e;
    }
  }

  async getStrainHistory(limit: number): Promise<WhoopCycle[]> {
    try {
      const response = await this.whoopFetch<{ records: WhoopCycle[] }>(
        `/v2/cycle?limit=${limit}&order=descending`,
      );
      return response.records || [];
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return [];
      throw e;
    }
  }

  async getWorkoutHistory(limit: number): Promise<WhoopWorkout[]> {
    try {
      const response = await this.whoopFetch<{ records: WhoopWorkout[] }>(
        `/v2/activity/workout?limit=${limit}&order=descending`,
      );
      return response.records || [];
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return [];
      throw e;
    }
  }

  async getSleepHistory(limit: number): Promise<WhoopSleep[]> {
    try {
      const response = await this.whoopFetch<{ records: WhoopSleep[] }>(
        `/v2/activity/sleep?limit=${limit}&order=descending`,
      );
      return response.records || [];
    } catch (e: any) {
      if (e.message === 'WHOOP_SCOPE_MISSING') return [];
      throw e;
    }
  }

  // ── Heart Rate Decay ───────────────────────────

  private calculateCurrentHeartRate(
    restingHR: number | null,
    workout: WhoopWorkout | null,
  ): { currentHeartRate: number; heartRateSource: 'resting' | 'workout' | 'decay' } {
    const resting = restingHR ?? 65;

    if (!workout?.end || !workout.score?.average_heart_rate) {
      return { currentHeartRate: resting, heartRateSource: 'resting' };
    }

    const timeSinceWorkout = Date.now() - new Date(workout.end).getTime();

    if (timeSinceWorkout >= HR_DECAY_PERIOD_MS) {
      return { currentHeartRate: resting, heartRateSource: 'resting' };
    }

    if (timeSinceWorkout < HR_RECENT_THRESHOLD_MS) {
      return { currentHeartRate: workout.score.average_heart_rate, heartRateSource: 'workout' };
    }

    // Exponential ease-out decay
    const progress = timeSinceWorkout / HR_DECAY_PERIOD_MS;
    const easedProgress = 1 - Math.pow(1 - progress, 2);
    const workoutHR = workout.score.average_heart_rate;
    const currentHR = Math.round(workoutHR - (workoutHR - resting) * easedProgress);

    return { currentHeartRate: currentHR, heartRateSource: 'decay' };
  }

  // ── Stats Aggregation ──────────────────────────

  private async fetchFreshStats(): Promise<WhoopStats> {
    const [recovery, cycle, sleep, workout] = await Promise.all([
      this.fetchRecovery(),
      this.fetchCycle(),
      this.fetchSleep(),
      this.fetchWorkout(),
    ]);

    const { currentHeartRate, heartRateSource } = this.calculateCurrentHeartRate(
      recovery?.score?.resting_heart_rate || null,
      workout,
    );

    // Workout duration
    let workoutDurationMinutes: number | null = null;
    if (workout?.start && workout?.end) {
      workoutDurationMinutes = Math.round(
        (new Date(workout.end).getTime() - new Date(workout.start).getTime()) / 60_000,
      );
    }

    // Convert kJ to kcal (1 kJ = 0.239 kcal)
    const cycleCals = cycle?.score?.kilojoule ? Math.round(cycle.score.kilojoule * 0.239) : null;
    const workoutCals = workout?.score?.kilojoule ? Math.round(workout.score.kilojoule * 0.239) : null;

    // Sleep duration from stages
    let sleepDurationMinutes: number | null = null;
    if (sleep?.score?.stage_summary) {
      const stages = sleep.score.stage_summary;
      const totalSleepMs =
        stages.total_light_sleep_time_milli +
        stages.total_slow_wave_sleep_time_milli +
        stages.total_rem_sleep_time_milli;
      sleepDurationMinutes = Math.round(totalSleepMs / 60_000);
    }

    return {
      connected: true,
      lastUpdated: new Date().toISOString(),

      recovery: recovery?.score?.recovery_score ?? null,
      restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
      hrv: recovery?.score?.hrv_rmssd_milli ?? null,
      spo2: recovery?.score?.spo2_percentage ?? null,
      skinTemp: recovery?.score?.skin_temp_celsius ?? null,

      strain: cycle?.score?.strain ?? null,
      calories: cycleCals,
      averageHeartRate: cycle?.score?.average_heart_rate ?? null,
      maxHeartRate: cycle?.score?.max_heart_rate ?? null,

      sleepPerformance: sleep?.score?.sleep_performance_percentage ?? null,
      sleepDuration: sleepDurationMinutes,
      sleepConsistency: sleep?.score?.sleep_consistency_percentage ?? null,
      sleepEfficiency: sleep?.score?.sleep_efficiency_percentage ?? null,
      respiratoryRate: sleep?.score?.respiratory_rate ?? null,

      lastWorkout: workout
        ? {
            sport: workout.sport_name || 'Activity',
            strain: workout.score?.strain ?? 0,
            duration: workoutDurationMinutes || 0,
            averageHeartRate: workout.score?.average_heart_rate ?? null,
            maxHeartRate: workout.score?.max_heart_rate ?? null,
            calories: workoutCals || 0,
            completedAt: workout.end,
          }
        : null,

      currentHeartRate,
      heartRateSource,
    };
  }

  // ── Public Interface ───────────────────────────

  async getStats(): Promise<WhoopStats> {
    // Cache-first
    const cached = await cache.getCached(this.cacheTtlMs);
    if (cached) return cached;

    const stats = await this.fetchFreshStats();
    await cache.setCached(stats);
    return stats;
  }

  async getRecovery(): Promise<WhoopRecovery | null> {
    return this.fetchRecovery();
  }

  async getStrain(): Promise<WhoopCycle | null> {
    return this.fetchCycle();
  }

  async getWorkout(): Promise<WhoopWorkout | null> {
    return this.fetchWorkout();
  }

  async getHeartRate(): Promise<HeartRateInfo> {
    const [recovery, workout] = await Promise.all([
      this.fetchRecovery(),
      this.fetchWorkout(),
    ]);
    const { currentHeartRate, heartRateSource } = this.calculateCurrentHeartRate(
      recovery?.score?.resting_heart_rate || null,
      workout,
    );
    return {
      currentHeartRate,
      heartRateSource,
      restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
    };
  }

  async getSleep(): Promise<WhoopSleep | null> {
    return this.fetchSleep();
  }

  async getSleepNeed(): Promise<WhoopSleepNeeded | null> {
    const sleep = await this.fetchSleep();
    return sleep?.score?.sleep_needed ?? null;
  }

  async authorize(): Promise<{ authUrl: string; waitForCallback: () => Promise<void> }> {
    // FIX 2: Pass state through for CSRF validation
    const { url: authUrl, state } = generateAuthUrl(this.clientId);

    const waitForCallback = async () => {
      const code = await startCallbackServer(state);
      const tokens = await exchangeCode(code, this.clientId, this.clientSecret);
      await saveTokens(tokens);
    };

    return { authUrl, waitForCallback };
  }

  async checkHealth(): Promise<HealthReport> {
    const endpoints: Record<string, string> = {
      recovery: '/v2/recovery?limit=1',
      cycle: '/v2/cycle?limit=1',
      sleep: '/v2/activity/sleep?limit=1',
      workout: '/v2/activity/workout?limit=1',
    };

    // Use getValidToken to ensure token is fresh (triggers refresh if needed)
    let token: string;
    try {
      token = await this.getToken();
    } catch {
      return {
        mode: 'direct',
        connected: false,
        endpoints: Object.fromEntries(
          Object.keys(endpoints).map((k) => [k, { status: 0, ok: false }]),
        ),
        allHealthy: false,
      };
    }

    const results: Record<string, EndpointHealth> = {};

    await Promise.all(
      Object.entries(endpoints).map(async ([name, path]) => {
        try {
          const response = await fetch(`${WHOOP_API_URL}${path}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          results[name] = { status: response.status, ok: response.ok };
        } catch {
          results[name] = { status: 0, ok: false };
        }
      }),
    );

    const allHealthy = Object.values(results).every((r) => r.ok);
    const tokens = await loadTokens();
    const tokenExpiry = tokens ? new Date(tokens.expires_at).toISOString() : undefined;

    return {
      mode: 'direct',
      connected: allHealthy,
      endpoints: results,
      tokenExpiry,
      allHealthy,
    };
  }

  async getCacheStatus(): Promise<CacheStatus> {
    return cache.getStatus(this.cacheTtlMs);
  }

  async invalidateCache(): Promise<void> {
    await cache.invalidate();
  }

  getConfig(): ServerConfig {
    return {
      mode: 'direct',
      apiTarget: WHOOP_API_URL,
      scopes: ALL_SCOPES,
      cacheTtlMs: this.cacheTtlMs,
    };
  }
}
