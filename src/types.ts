// ============================================
// WHOOP API Types
// Ported from Patrick's site with sleep enabled
// ============================================

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp (ms)
}

export interface WhoopProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopBodyMeasurement {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

export interface WhoopCycleScore {
  strain: number;
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: WhoopCycleScore | null;
}

export interface WhoopRecoveryScore {
  user_calibrating: boolean;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage: number;
  skin_temp_celsius: number;
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: WhoopRecoveryScore | null;
}

export interface WhoopSleepStages {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
}

export interface WhoopSleepNeeded {
  baseline_milli: number;
  need_from_sleep_debt_milli: number;
  need_from_recent_strain_milli: number;
  need_from_recent_nap_milli: number;
}

export interface WhoopSleepScore {
  stage_summary: WhoopSleepStages;
  sleep_needed: WhoopSleepNeeded;
  respiratory_rate: number;
  sleep_performance_percentage: number;
  sleep_consistency_percentage: number;
  sleep_efficiency_percentage: number;
}

export interface WhoopSleep {
  id: string;
  cycle_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: WhoopSleepScore | null;
}

export interface WhoopWorkoutZones {
  zone_zero_milli: number;
  zone_one_milli: number;
  zone_two_milli: number;
  zone_three_milli: number;
  zone_four_milli: number;
  zone_five_milli: number;
}

export interface WhoopWorkoutScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
  percent_recorded: number;
  distance_meter?: number;
  altitude_gain_meter?: number;
  altitude_change_meter?: number;
  zone_durations: WhoopWorkoutZones;
}

export interface WhoopWorkout {
  id: string;
  v1_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_id: number;
  sport_name: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: WhoopWorkoutScore | null;
}

// ============================================
// Aggregated Stats
// ============================================

export interface WhoopStats {
  connected: boolean;
  lastUpdated: string | null;

  // Recovery
  recovery: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
  spo2: number | null;
  skinTemp: number | null;

  // Strain
  strain: number | null;
  calories: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;

  // Sleep (enabled in MCP, disabled on website)
  sleepPerformance: number | null;
  sleepDuration: number | null; // minutes
  sleepConsistency: number | null;
  sleepEfficiency: number | null;
  respiratoryRate: number | null;

  // Last workout
  lastWorkout: {
    sport: string;
    strain: number;
    duration: number; // minutes
    averageHeartRate: number | null;
    maxHeartRate: number | null;
    calories: number;
    completedAt: string;
  } | null;

  // HR animation
  currentHeartRate: number;
  heartRateSource: 'resting' | 'workout' | 'decay';
}

// ============================================
// MCP Server Types
// ============================================

export interface HeartRateInfo {
  currentHeartRate: number;
  heartRateSource: 'resting' | 'workout' | 'decay';
  restingHeartRate: number | null;
}

export interface EndpointHealth {
  status: number;
  ok: boolean;
}

export interface HealthReport {
  mode: 'remote' | 'direct';
  connected: boolean;
  endpoints: Record<string, EndpointHealth>;
  tokenExpiry?: string;
  allHealthy: boolean;
}

export interface CacheStatus {
  hasCachedData: boolean;
  fetchedAt: string | null;
  ageMs: number | null;
  ttlMs: number;
  ttlRemainingMs: number | null;
  isStale: boolean;
}

export interface ServerConfig {
  mode: 'remote' | 'direct';
  baseUrl?: string;
  apiTarget?: string;
  scopes?: string[];
  cacheTtlMs: number;
}

export interface CacheData {
  stats: WhoopStats;
  fetchedAt: string;
}
