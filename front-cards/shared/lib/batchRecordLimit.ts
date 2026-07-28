/**
 * Batch record count limits — env defaults with per-user override from Tools Dashboard Access tab.
 *
 * Precedence: user `batch_size_limit` (subscription.features) → env var → mode fallback (demo 50 / prod 5000).
 * `-1` means unlimited.
 */

import { isDemoMode, isEnvDemoMode } from '@/features/demo/isDemoMode';
import type { User } from '@/shared/types/auth';

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

export function capBatchRecords<T>(
  records: T[],
  limit: number
): { records: T[]; truncated: boolean; skipped: number } {
  if (isUnlimitedBatchRecordLimit(limit) || records.length <= limit) {
    return { records, truncated: false, skipped: 0 };
  }
  return {
    records: records.slice(0, limit),
    truncated: true,
    skipped: records.length - limit,
  };
}

export function effectivePageSize(requested: number, limit: number): number {
  if (isUnlimitedBatchRecordLimit(limit)) return requested;
  return Math.min(requested, limit);
}

export function effectiveExportPageSize(limit: number): number {
  if (isUnlimitedBatchRecordLimit(limit)) return 500;
  return Math.min(500, limit);
}

/** Resolve the active batch record cap in the browser (demo + authenticated normal). */
export function getClientBatchRecordLimit(user?: User | null): ResolvedBatchRecordLimit {
  return resolveBatchRecordLimit({
    isDemo: typeof window === 'undefined' ? isEnvDemoMode() : isDemoMode(),
    envLimitDemo: process.env.NEXT_PUBLIC_BATCH_RECORD_LIMIT_DEMO,
    envLimitDefault: process.env.NEXT_PUBLIC_BATCH_RECORD_LIMIT,
    userBatchSizeLimit: user?.subscription?.features?.batch_size_limit,
  });
}
