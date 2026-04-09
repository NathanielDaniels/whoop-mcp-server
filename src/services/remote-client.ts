import axios from 'axios';
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
} from '../types.js';
import { REMOTE_TIMEOUT_MS, DEFAULT_CACHE_TTL_MS } from '../constants.js';

export class RemoteClient implements WhoopClient {
  private baseUrl: string;
  private cachedStats: WhoopStats | null = null;
  private cachedAt: number | null = null;
  private cacheTtlMs: number;

  constructor(baseUrl: string, cacheTtlMs = DEFAULT_CACHE_TTL_MS) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    // FIX 8: Warn if remote URL uses HTTP (except localhost)
    if (this.baseUrl.startsWith('http://') && !this.baseUrl.includes('localhost')) {
      console.warn('[remote] WARNING: WHOOP_BASE_URL uses HTTP. Use HTTPS in production.');
    }
    this.cacheTtlMs = cacheTtlMs;
  }

  private async fetchStats(): Promise<WhoopStats> {
    // Return cached if fresh
    if (this.cachedStats && this.cachedAt && Date.now() - this.cachedAt < this.cacheTtlMs) {
      return this.cachedStats;
    }

    const { data } = await axios.get<WhoopStats & { mode?: string }>(
      `${this.baseUrl}/api/whoop/stats`,
      { timeout: REMOTE_TIMEOUT_MS },
    );

    // Normalize: remote site may not include sleep fields
    const stats: WhoopStats = {
      connected: data.connected ?? false,
      lastUpdated: data.lastUpdated ?? null,
      recovery: data.recovery ?? null,
      restingHeartRate: data.restingHeartRate ?? null,
      hrv: data.hrv ?? null,
      spo2: data.spo2 ?? null,
      skinTemp: data.skinTemp ?? null,
      strain: data.strain ?? null,
      calories: data.calories ?? null,
      averageHeartRate: data.averageHeartRate ?? null,
      maxHeartRate: data.maxHeartRate ?? null,
      sleepPerformance: data.sleepPerformance ?? null,
      sleepDuration: data.sleepDuration ?? null,
      sleepConsistency: data.sleepConsistency ?? null,
      sleepEfficiency: data.sleepEfficiency ?? null,
      respiratoryRate: data.respiratoryRate ?? null,
      lastWorkout: data.lastWorkout ?? null,
      currentHeartRate: data.currentHeartRate ?? 65,
      heartRateSource: data.heartRateSource ?? 'resting',
    };

    this.cachedStats = stats;
    this.cachedAt = Date.now();
    return stats;
  }

  async getStats(): Promise<WhoopStats> {
    return this.fetchStats();
  }

  async getRecovery(): Promise<WhoopRecovery | null> {
    const stats = await this.fetchStats();
    if (stats.recovery === null) return null;

    // Reconstruct a WhoopRecovery-like object from the flat stats
    return {
      cycle_id: 0,
      sleep_id: '',
      user_id: 0,
      created_at: stats.lastUpdated || '',
      updated_at: stats.lastUpdated || '',
      score_state: 'SCORED',
      score: {
        user_calibrating: false,
        recovery_score: stats.recovery,
        resting_heart_rate: stats.restingHeartRate ?? 0,
        hrv_rmssd_milli: stats.hrv ?? 0,
        spo2_percentage: stats.spo2 ?? 0,
        skin_temp_celsius: stats.skinTemp ?? 0,
      },
    };
  }

  async getStrain(): Promise<WhoopCycle | null> {
    const stats = await this.fetchStats();
    if (stats.strain === null) return null;

    return {
      id: 0,
      user_id: 0,
      created_at: stats.lastUpdated || '',
      updated_at: stats.lastUpdated || '',
      start: stats.lastUpdated || '',
      end: '',
      timezone_offset: '',
      score_state: 'SCORED',
      score: {
        strain: stats.strain,
        kilojoule: stats.calories ? Math.round(stats.calories / 0.239) : 0,
        average_heart_rate: stats.averageHeartRate ?? 0,
        max_heart_rate: stats.maxHeartRate ?? 0,
      },
    };
  }

  async getWorkout(): Promise<WhoopWorkout | null> {
    const stats = await this.fetchStats();
    if (!stats.lastWorkout) return null;

    const w = stats.lastWorkout;
    const endTime = new Date(w.completedAt);
    const startTime = new Date(endTime.getTime() - w.duration * 60_000);

    return {
      id: '',
      v1_id: 0,
      user_id: 0,
      created_at: w.completedAt,
      updated_at: w.completedAt,
      start: startTime.toISOString(),
      end: w.completedAt,
      timezone_offset: '',
      sport_id: 0,
      sport_name: w.sport,
      score_state: 'SCORED',
      score: {
        strain: w.strain,
        average_heart_rate: w.averageHeartRate ?? 0,
        max_heart_rate: w.maxHeartRate ?? 0,
        kilojoule: w.calories ? Math.round(w.calories / 0.239) : 0,
        percent_recorded: 100,
        zone_durations: {
          zone_zero_milli: 0,
          zone_one_milli: 0,
          zone_two_milli: 0,
          zone_three_milli: 0,
          zone_four_milli: 0,
          zone_five_milli: 0,
        },
      },
    };
  }

  async getHeartRate(): Promise<HeartRateInfo> {
    const stats = await this.fetchStats();
    return {
      currentHeartRate: stats.currentHeartRate,
      heartRateSource: stats.heartRateSource,
      restingHeartRate: stats.restingHeartRate,
    };
  }

  async getSleep(): Promise<WhoopSleep | null> {
    const stats = await this.fetchStats();
    if (stats.sleepPerformance === null) return null;

    // Remote mode may not have full sleep data if the site doesn't expose it
    return {
      id: '',
      cycle_id: 0,
      user_id: 0,
      created_at: stats.lastUpdated || '',
      updated_at: stats.lastUpdated || '',
      start: '',
      end: '',
      timezone_offset: '',
      nap: false,
      score_state: 'SCORED',
      score: {
        stage_summary: {
          total_in_bed_time_milli: (stats.sleepDuration ?? 0) * 60_000,
          total_awake_time_milli: 0,
          total_no_data_time_milli: 0,
          total_light_sleep_time_milli: 0,
          total_slow_wave_sleep_time_milli: 0,
          total_rem_sleep_time_milli: 0,
          sleep_cycle_count: 0,
          disturbance_count: 0,
        },
        sleep_needed: {
          baseline_milli: 0,
          need_from_sleep_debt_milli: 0,
          need_from_recent_strain_milli: 0,
          need_from_recent_nap_milli: 0,
        },
        respiratory_rate: stats.respiratoryRate ?? 0,
        sleep_performance_percentage: stats.sleepPerformance ?? 0,
        sleep_consistency_percentage: stats.sleepConsistency ?? 0,
        sleep_efficiency_percentage: stats.sleepEfficiency ?? 0,
      },
    };
  }

  async getSleepNeed(): Promise<WhoopSleepNeeded | null> {
    // Remote mode doesn't have granular sleep need data
    return null;
  }

  async getRecoveryHistory(_limit: number): Promise<WhoopRecovery[]> {
    throw new Error('History tools require direct mode. Remote mode only has the latest snapshot.');
  }

  async getStrainHistory(_limit: number): Promise<WhoopCycle[]> {
    throw new Error('History tools require direct mode. Remote mode only has the latest snapshot.');
  }

  async getWorkoutHistory(_limit: number): Promise<WhoopWorkout[]> {
    throw new Error('History tools require direct mode. Remote mode only has the latest snapshot.');
  }

  async getSleepHistory(_limit: number): Promise<WhoopSleep[]> {
    throw new Error('History tools require direct mode. Remote mode only has the latest snapshot.');
  }

  async authorize(): Promise<{ authUrl: string; waitForCallback: () => Promise<void> }> {
    throw new Error('Authorization is not available in remote mode. Switch to direct mode to use OAuth.');
  }

  async checkHealth(): Promise<HealthReport> {
    try {
      const { status } = await axios.get(
        `${this.baseUrl}/api/whoop/stats`,
        { timeout: REMOTE_TIMEOUT_MS, validateStatus: () => true },
      );
      const ok = status >= 200 && status < 300;
      return {
        mode: 'remote',
        connected: ok,
        endpoints: { stats: { status, ok } },
        allHealthy: ok,
      };
    } catch {
      return {
        mode: 'remote',
        connected: false,
        endpoints: { stats: { status: 0, ok: false } },
        allHealthy: false,
      };
    }
  }

  async getCacheStatus(): Promise<CacheStatus> {
    const hasCachedData = this.cachedStats !== null;
    const ageMs = this.cachedAt ? Date.now() - this.cachedAt : null;
    return {
      hasCachedData,
      fetchedAt: this.cachedAt ? new Date(this.cachedAt).toISOString() : null,
      ageMs,
      ttlMs: this.cacheTtlMs,
      ttlRemainingMs: ageMs !== null ? Math.max(0, this.cacheTtlMs - ageMs) : null,
      isStale: ageMs !== null ? ageMs > this.cacheTtlMs : true,
    };
  }

  async invalidateCache(): Promise<void> {
    this.cachedStats = null;
    this.cachedAt = null;
  }

  getConfig(): ServerConfig {
    return {
      mode: 'remote',
      baseUrl: this.baseUrl,
      cacheTtlMs: this.cacheTtlMs,
    };
  }
}
