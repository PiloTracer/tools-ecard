/**
 * Tools Dashboard — Application library storage integration.
 *
 * When TOOLS_DASHBOARD_ORIGIN and APP_LIBRARY_STORAGE_INTEGRATION_KEY are set,
 * the API loads storage metadata via:
 *   GET {origin}/api/integrations/app-library/storage
 *   Authorization: Bearer {APP_LIBRARY_STORAGE_INTEGRATION_KEY}
 *
 * `public_files_base_url` is only applied to API-returned object URLs when you opt in (see
 * `STORAGE_USE_DASHBOARD_PUBLIC_BASE` / `STORAGE_PUBLIC_BUCKETS`). Default is private objects →
 * URLs use `SEAWEEDFS_ENDPOINT` path shape; use presigned GET for browser downloads of private objects.
 *
 * Startup GET uses `oauthServerFetch` (same dev TLS rules as OAuth: relaxed in non-production unless
 * `OAUTH_DEV_INSECURE_TLS` is off; strict `fetch` in production, or use `NODE_EXTRA_CA_CERTS`).
 *
 * S3-compatible upload/download still use SEAWEEDFS_*; this flow does not replace those credentials.
 *
 * **Contract:** import public URL helpers from `core/storage` (re-exports `resolvePublicObjectUrl`, etc.).
 */

import { z } from 'zod';
import { oauthServerFetch } from '../oauthFetch';
import { createLogger, serializeError } from '../utils/logger';

const log = createLogger('AppLibraryStorageIntegration');

const storageResponseSchema = z.object({
  app: z.object({
    id: z.string(),
    client_id: z.string(),
    client_name: z.string(),
  }),
  storage: z.object({
    public_files_base_url: z.string().min(1),
    integration_auth: z.string().optional(),
    endpoint: z.string().optional(),
    note: z.string().optional(),
  }),
});

export type AppLibraryStoragePayload = z.infer<typeof storageResponseSchema>;

let cachedPayload: AppLibraryStoragePayload | null = null;
let normalizedPublicBase: string | null = null;
let inFlight: Promise<void> | null = null;

export function isAppLibraryStorageIntegrationEnabled(): boolean {
  const origin = (process.env.TOOLS_DASHBOARD_ORIGIN || '').trim();
  const key = (process.env.APP_LIBRARY_STORAGE_INTEGRATION_KEY || '').trim();
  return Boolean(origin && key);
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/**
 * Fetches and caches storage integration metadata (idempotent).
 * Call during API startup before serving traffic that returns public file URLs.
 */
export async function ensureAppLibraryStorageIntegrationReady(): Promise<void> {
  if (!isAppLibraryStorageIntegrationEnabled()) {
    return;
  }
  if (cachedPayload && normalizedPublicBase) {
    return;
  }
  if (!inFlight) {
    inFlight = loadFromToolsDashboard().finally(() => {
      inFlight = null;
    });
  }
  await inFlight;
}

async function loadFromToolsDashboard(): Promise<void> {
  const origin = normalizeOrigin((process.env.TOOLS_DASHBOARD_ORIGIN || '').trim());
  const key = (process.env.APP_LIBRARY_STORAGE_INTEGRATION_KEY || '').trim();
  const url = `${origin}/api/integrations/app-library/storage`;

  let res: Response;
  try {
    res = await oauthServerFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch (err) {
    log.error({ err: serializeError(err), url }, 'App library storage integration request failed');
    throw new Error('App library storage integration: network error calling Tools Dashboard');
  }

  if (!res.ok) {
    const body = await res.text();
    log.error(
      { status: res.status, bodyPreview: body.slice(0, 240) },
      'App library storage integration GET failed',
    );
    throw new Error(`App library storage integration: HTTP ${res.status}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('App library storage integration: response was not JSON');
  }

  const parsed = storageResponseSchema.safeParse(json);
  if (!parsed.success) {
    log.error({ issues: parsed.error.flatten() }, 'App library storage response validation failed');
    throw new Error('App library storage integration: response JSON did not match expected shape');
  }

  cachedPayload = parsed.data;
  normalizedPublicBase = parsed.data.storage.public_files_base_url.replace(/\/+$/, '');

  log.info(
    {
      appId: cachedPayload.app.id,
      clientName: cachedPayload.app.client_name,
      publicFilesBaseUrl: normalizedPublicBase,
    },
    'App library storage integration loaded',
  );
}

/**
 * Public URL for an object when integration is loaded; otherwise null.
 */
export function getAppLibraryPublicFileUrl(bucket: string, key: string): string | null {
  if (!normalizedPublicBase) {
    return null;
  }
  const b = bucket.replace(/^\/+|\/+$/g, '');
  const k = key.replace(/^\/+/, '');
  return `${normalizedPublicBase}/${b}/${k}`;
}

/** True after startup successfully loaded public_files_base_url from Tools Dashboard. */
export function isAppLibraryStoragePublicBaseReady(): boolean {
  return Boolean(normalizedPublicBase);
}

function parsePublicBucketAllowlist(): Set<string> {
  return new Set(
    (process.env.STORAGE_PUBLIC_BUCKETS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Whether API-returned object URLs may use Tools Dashboard `public_files_base_url` for this bucket.
 * Default false (private objects): use `SEAWEEDFS_ENDPOINT` path unless `STORAGE_USE_DASHBOARD_PUBLIC_BASE=true`
 * or the bucket is listed in `STORAGE_PUBLIC_BUCKETS`.
 */
export function shouldUseDashboardPublicUrlForBucket(bucket: string): boolean {
  if (!isAppLibraryStoragePublicBaseReady()) {
    return false;
  }
  if (process.env.STORAGE_USE_DASHBOARD_PUBLIC_BASE === 'true') {
    return true;
  }
  return parsePublicBucketAllowlist().has(bucket);
}

/**
 * URL string returned in API payloads for an object (not presigned; not the internal `s3://` form).
 * Private default: `SEAWEEDFS_ENDPOINT`/`bucket`/`key` (works across separate Docker networks when the
 * endpoint is a reachable host or TLS URL in production). Dashboard public base only when opted in per bucket.
 */
export function resolvePublicObjectUrl(bucket: string, key: string): string {
  if (shouldUseDashboardPublicUrlForBucket(bucket)) {
    const via = getAppLibraryPublicFileUrl(bucket, key);
    if (via) {
      return via;
    }
  }
  const ep = (process.env.SEAWEEDFS_ENDPOINT || '').replace(/\/+$/, '');
  const b = bucket.replace(/^\/+|\/+$/g, '');
  const k = key.replace(/^\/+/, '');
  return `${ep}/${b}/${k}`;
}

/** For diagnostics (no secrets). */
export function getAppLibraryStorageIntegrationStatus(): {
  enabled: boolean;
  loaded: boolean;
  publicBaseReady: boolean;
  dashboardPublicUrlsGlobal: boolean;
  dashboardPublicBucketsConfigured: boolean;
  appId?: string;
  publicFilesBaseUrl?: string;
} {
  const allow = parsePublicBucketAllowlist();
  return {
    enabled: isAppLibraryStorageIntegrationEnabled(),
    loaded: Boolean(cachedPayload && normalizedPublicBase),
    publicBaseReady: isAppLibraryStoragePublicBaseReady(),
    dashboardPublicUrlsGlobal: process.env.STORAGE_USE_DASHBOARD_PUBLIC_BASE === 'true',
    dashboardPublicBucketsConfigured: allow.size > 0,
    appId: cachedPayload?.app.id,
    publicFilesBaseUrl: normalizedPublicBase ?? undefined,
  };
}
