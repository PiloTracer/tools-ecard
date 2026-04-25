/**
 * Storage contract — E-Cards API server (single mental model)
 *
 * **Networks:** This app is expected to run on a **different** Docker (or host) network than SeaweedFS and
 * Tools Dashboard. Reach Seaweed only via `SEAWEEDFS_ENDPOINT` (e.g. published host port in dev, `https://…` in prod).
 * Tools Dashboard is reached via `TOOLS_DASHBOARD_ORIGIN` for the app-library integration GET only.
 *
 * | Layer | Mechanism | Notes |
 * |-------|-----------|--------|
 * | **Transport** | AWS S3 SDK → `SEAWEEDFS_*` | Private objects; direct E-Cards ↔ Seaweed is supported. |
 * | **API “object URL” string** | `resolvePublicObjectUrl(bucket, key)` | Default: path under `SEAWEEDFS_ENDPOINT`. Optional: Tools `public_files_base_url` when `STORAGE_USE_DASHBOARD_PUBLIC_BASE=true` or bucket ∈ `STORAGE_PUBLIC_BUCKETS`. |
 * | **Cassandra / internal** | `s3://bucket/key` | Canonical reference for template resources; SDK only — not a browser URL. |
 * | **Presigned GET** | S3 signing on `SEAWEEDFS_ENDPOINT` | Use for **private** browser downloads; different from the optional dashboard public base. |
 *
 * Do not hand-build `https?://…/bucket/key` outside this module — use `resolvePublicObjectUrl`.
 */

export {
  ensureAppLibraryStorageIntegrationReady,
  getAppLibraryStorageIntegrationStatus,
  isAppLibraryStorageIntegrationEnabled,
  isAppLibraryStoragePublicBaseReady,
  resolvePublicObjectUrl,
  shouldUseDashboardPublicUrlForBucket,
} from '../integrations/appLibraryStorageIntegration';
