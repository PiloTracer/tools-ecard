/**
 * Demo mode constants — browser-only persistence namespace
 */

export const DEMO_ENABLED_KEY = 'ecards:demo:enabled';
export const DEMO_PROJECTS_KEY = 'ecards:demo:projects';
export const DEMO_SELECTED_PROJECT_KEY = 'ecards:demo:selectedProjectId';
export const DEMO_TEMPLATES_KEY = 'ecards:demo:templates';
export const DEMO_BATCHES_KEY = 'ecards:demo:batches';
export const DEMO_BATCH_RECORDS_PREFIX = 'ecards:demo:batchRecords:';
export const DEMO_FONTS_META_KEY = 'ecards:demo:fonts';

export const DEMO_IDB_NAME = 'ecards-demo';
export const DEMO_IDB_VERSION = 1;
export const DEMO_BLOB_STORE = 'blobs';

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
