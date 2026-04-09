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

export interface WhoopClient {
  getStats(): Promise<WhoopStats>;
  getRecovery(): Promise<WhoopRecovery | null>;
  getStrain(): Promise<WhoopCycle | null>;
  getWorkout(): Promise<WhoopWorkout | null>;
  getHeartRate(): Promise<HeartRateInfo>;
  getSleep(): Promise<WhoopSleep | null>;
  getSleepNeed(): Promise<WhoopSleepNeeded | null>;
  getRecoveryHistory(limit: number): Promise<WhoopRecovery[]>;
  getStrainHistory(limit: number): Promise<WhoopCycle[]>;
  getWorkoutHistory(limit: number): Promise<WhoopWorkout[]>;
  getSleepHistory(limit: number): Promise<WhoopSleep[]>;
  authorize(): Promise<{ authUrl: string; waitForCallback: () => Promise<void> }>;
  checkHealth(): Promise<HealthReport>;
  getCacheStatus(): Promise<CacheStatus>;
  invalidateCache(): Promise<void>;
  getConfig(): ServerConfig;
}
