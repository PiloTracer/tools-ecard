/**
 * Server-side batch record limit resolution (mirrors front-cards/shared/lib/batchRecordLimit.ts).
 */

import { isDemoModeEnabled } from '../middleware/demoModeGuard';

export const BATCH_RECORD_LIMIT_DEMO_FALLBACK = 50;
export const BATCH_RECORD_LIMIT_PROD_FALLBACK = 5000;
export const BATCH_RECORD_LIMIT_UNLIMITED = -1;

export type BatchRecordLimitSource = 'user' | 'env' | 'fallback';

export type ResolvedBatchRecordLimit = {
  limit: number;
  unlimited: boolean;
  source: BatchRecordLimitSource;
};

export function parseBatchRecordLimitValue(
  raw: string | number | null | undefined
): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < BATCH_RECORD_LIMIT_UNLIMITED) return null;
  return n;
}

export function extractUserBatchSizeLimit(
  userData: Record<string, unknown> | null | undefined
): number | null {
  if (!userData) return null;
  const subscription = userData.subscription as Record<string, unknown> | undefined;
  const features =
    (subscription?.features as Record<string, unknown> | undefined) ??
    (userData.features as Record<string, unknown> | undefined);
  const raw =
    features?.batch_size_limit ??
    features?.batchSizeLimit ??
    subscription?.batch_size_limit ??
    subscription?.batchSizeLimit ??
    userData.batch_size_limit ??
    userData.batchSizeLimit;
  return parseBatchRecordLimitValue(raw as string | number | null | undefined);
}

export function resolveBatchRecordLimit(options: {
  isDemo: boolean;
  envLimitDemo?: string | number | null;
  envLimitDefault?: string | number | null;
  userBatchSizeLimit?: string | number | null;
}): ResolvedBatchRecordLimit {
  const userParsed = parseBatchRecordLimitValue(options.userBatchSizeLimit ?? null);
  if (userParsed !== null) {
    return {
      limit: userParsed,
      unlimited: userParsed === BATCH_RECORD_LIMIT_UNLIMITED,
      source: 'user',
    };
  }

  const envRaw = options.isDemo ? options.envLimitDemo : options.envLimitDefault;
  const envParsed = parseBatchRecordLimitValue(envRaw ?? null);
  if (envParsed !== null) {
    return {
      limit: envParsed,
      unlimited: envParsed === BATCH_RECORD_LIMIT_UNLIMITED,
      source: 'env',
    };
  }

  const fallback = options.isDemo
    ? BATCH_RECORD_LIMIT_DEMO_FALLBACK
    : BATCH_RECORD_LIMIT_PROD_FALLBACK;
  return {
    limit: fallback,
    unlimited: false,
    source: 'fallback',
  };
}

export function isUnlimitedBatchRecordLimit(limit: number): boolean {
  return limit === BATCH_RECORD_LIMIT_UNLIMITED;
}

export function effectivePageSize(requested: number, limit: number): number {
  if (isUnlimitedBatchRecordLimit(limit)) return requested;
  return Math.min(requested, limit);
}

export function resolveServerBatchRecordLimit(
  userBatchSizeLimit?: number | null
): ResolvedBatchRecordLimit {
  return resolveBatchRecordLimit({
    isDemo: isDemoModeEnabled(),
    envLimitDemo: process.env.BATCH_RECORD_LIMIT_DEMO,
    envLimitDefault: process.env.BATCH_RECORD_LIMIT,
    userBatchSizeLimit,
  });
}
