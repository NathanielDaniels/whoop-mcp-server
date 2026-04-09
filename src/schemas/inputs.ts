import { z } from 'zod';

const responseFormat = z.enum(['markdown', 'json']).default('markdown')
  .describe('Response format: markdown (human-readable) or json (structured data)');

// Tier 1 — Biometrics
export const getStatsInput = z.object({ response_format: responseFormat });
export const getRecoveryInput = z.object({ response_format: responseFormat });
export const getStrainInput = z.object({ response_format: responseFormat });
export const getWorkoutInput = z.object({
  response_format: responseFormat,
  include_zones: z.boolean().default(false)
    .describe('Include heart rate zone breakdown'),
});
export const getHeartRateInput = z.object({ response_format: responseFormat });
export const getSleepInput = z.object({
  response_format: responseFormat,
  include_stages: z.boolean().default(true)
    .describe('Include sleep stage breakdown'),
});
export const getSleepNeedInput = z.object({ response_format: responseFormat });

// History
const historyLimit = z.number().int().min(1).max(25).default(7)
  .describe('Number of records to return (1-25, default 7)');

export const getRecoveryHistoryInput = z.object({
  response_format: responseFormat,
  limit: historyLimit,
});
export const getStrainHistoryInput = z.object({
  response_format: responseFormat,
  limit: historyLimit,
});
export const getWorkoutHistoryInput = z.object({
  response_format: responseFormat,
  limit: historyLimit,
});
export const getSleepHistoryInput = z.object({
  response_format: responseFormat,
  limit: historyLimit,
});

// Tier 2 — Diagnostics
export const checkHealthInput = z.object({ response_format: responseFormat });
export const getCacheStatusInput = z.object({ response_format: responseFormat });
export const invalidateCacheInput = z.object({});
export const getConfigInput = z.object({ response_format: responseFormat });
