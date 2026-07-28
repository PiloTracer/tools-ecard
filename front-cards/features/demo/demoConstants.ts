/**
 * Demo mode constants — browser-only persistence namespace
 */

export const DEMO_ENABLED_KEY = 'ecards:demo:enabled';
/** Suffix under per-user namespace — full key: ecards:demo:u:{userId}:batchRecords:{batchId} */
export const DEMO_BATCH_RECORDS_PREFIX = 'batchRecords:';
export const DEMO_IDB_VERSION = 1;
export const DEMO_BLOB_STORE = 'blobs';

/**
 * @deprecated Demo auth uses real OAuth users. Kept for legacy tests/docs only.
 */
export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@localhost',
  name: 'Demo User',
  authenticated: true,
} as const;

export function truthyEnv(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
