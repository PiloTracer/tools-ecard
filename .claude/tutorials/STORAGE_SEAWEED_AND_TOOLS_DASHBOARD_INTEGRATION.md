# SeaweedFS + Tools Dashboard storage integration (E-Cards)

This guide covers **direct Seaweed S3** (upload/download/list) and the **Tools Dashboard application-library** integration (minted key, optional public URL policy). For stack ports and compose commands, see repo root **`DOCS_TECH_STACK.md`**.

---

## 1. Concepts (read once)

| Layer | Purpose | Configuration |
|--------|---------|----------------|
| **S3 transport** | All `PutObject` / `GetObject` / deletes / batch Python downloads | `SEAWEEDFS_ENDPOINT`, keys, bucket, region. E-Cards talks to Seaweed **directly** (separate Docker network is OK). |
| **Tools Dashboard GET** | Validates minted key; returns `public_files_base_url` and app metadata | `TOOLS_DASHBOARD_ORIGIN`, `APP_LIBRARY_STORAGE_INTEGRATION_KEY`. Path is fixed in code: `{origin}/api/integrations/app-library/storage`. |
| **API “object URL” strings** | What JSON responses put in `location`, batch `url`, etc. | `resolvePublicObjectUrl` via **`api-server/src/core/storage`**. Default = path under `SEAWEEDFS_ENDPOINT` (private). Dashboard CDN base only if you opt in (see below). |
| **Internal references** | Cassandra template resources | `s3://bucket/key` — SDK only, not a browser URL. |
| **Browser access to private bytes** | Images/fonts/files | **Resource proxy** routes on the API, or **presigned** `GET` URLs (`POST /api/v1/s3/presigned-url`). |

Canonical contract comment: `api-server/src/core/storage/index.ts`.

---

## 2. Integration steps

### Step A — Seaweed S3 (required for real object storage)

1. **Run Seaweed** (or use an existing deployment) with the **S3 gateway** reachable from the E-Cards **api-server** container.  
   - Example: host mapping **`18333:8333`** → set `SEAWEEDFS_ENDPOINT=http://host.docker.internal:18333` in dev (not `8333` on the host unless you publish that port).
2. **Monorepo root `.env`** (used by `docker-compose.dev.yml` and `api-server` via `env_file`):
   - `USE_LOCAL_STORAGE=false` when you want Seaweed.
   - `SEAWEEDFS_ENDPOINT`, `SEAWEEDFS_ACCESS_KEY`, `SEAWEEDFS_SECRET_KEY`, `SEAWEEDFS_BUCKET`, `SEAWEEDFS_REGION`.
3. **Docker (Linux):** `api-server` and `render-worker` include `extra_hosts: host.docker.internal:host-gateway` in **`docker-compose.dev.yml`** so `host.docker.internal` resolves.  
   - `render-worker` also needs the same if it ever uses Seaweed env vars at runtime.
4. **Production:** use a real HTTPS (or internal) URL for `SEAWEEDFS_ENDPOINT` and credentials your ops team issues — no requirement to share Seaweed’s Docker network with E-Cards.

### Step B — Tools Dashboard app-library integration (optional)

1. In **Tools Dashboard** admin: **Application library → your app → Storage → Mint new key** (`tdsk_…`).
2. In **E-Cards** `.env`:
   - `TOOLS_DASHBOARD_ORIGIN=https://dev.aiepic.app` (no trailing slash; prod: your prod origin).
   - `APP_LIBRARY_STORAGE_INTEGRATION_KEY=tdsk_…`
3. **api-server** startup calls `GET {TOOLS_DASHBOARD_ORIGIN}/api/integrations/app-library/storage` with `Authorization: Bearer …` **before** the app listens. Failure **exits the process** (misconfigured key or unreachable dashboard).
4. **Compose:** `docker-compose.dev.yml` and **`docker-compose.prd.yml`** pass the same keys on **`api-server`** `environment:` as in **`.env`** (including `NEXT_PUBLIC_API_URL` for server-side template URL rewriting).

### Step C — Public URL policy (private by default)

1. **Default (private objects):** leave  
   `STORAGE_USE_DASHBOARD_PUBLIC_BASE=false`  
   and leave `STORAGE_PUBLIC_BUCKETS` empty.  
   API-returned URLs use **`SEAWEEDFS_ENDPOINT`** path shape; browsers should **not** rely on opening that URL alone — use **resource proxy**, **batch APIs**, or **presigned GET**.
2. **Future public buckets:** set `STORAGE_PUBLIC_BUCKETS=bucket1,bucket2` and/or `STORAGE_USE_DASHBOARD_PUBLIC_BASE=true` only when objects are **anonymously readable** via Tools Dashboard `/storage/…`.

### Step D — Same host the browser uses for the API

1. Set **`NEXT_PUBLIC_API_URL`** in root `.env` to the URL **browsers** use to reach the E-Cards API (e.g. `http://localhost:7400` in dev).  
2. The **api-server** uses the same value (via `appConfig.publicApi.baseUrl`) to rewrite **`s3://`** image references in loaded templates to **`/api/v1/template-textile/resource/...`** URLs.  
3. Optional override: **`API_PUBLIC_ENDPOINT`** if the public API base differs from `NEXT_PUBLIC_API_URL`.

---

## 3. Checklist — verify integration

Use this after changing `.env` or compose; restart **`api-server`** (and worker if applicable).

### Seaweed (S3)

- [ ] `USE_LOCAL_STORAGE=false` when testing Seaweed.
- [ ] `SEAWEEDFS_ENDPOINT` matches **published** host:port or HTTPS URL (e.g. `:18333` if mapped `18333:8333`).
- [ ] From **inside** the api container: `wget -S -O /dev/null --timeout=3 "$SEAWEEDFS_ENDPOINT/"` returns HTTP (e.g. 403) not “connection refused”.
- [ ] Keys and bucket name match what Seaweed/S3 is configured to accept.
- [ ] Default buckets or your bucket exists (or `initializeS3Feature` / first upload can create it per your Seaweed policy).

### Tools Dashboard integration

- [ ] `TOOLS_DASHBOARD_ORIGIN` has **no** trailing slash.
- [ ] `APP_LIBRARY_STORAGE_INTEGRATION_KEY` is the **full** minted string.
- [ ] `GET /health` on the API includes `appLibraryStorage` with `enabled` / `loaded` / `publicBaseReady` as expected for your env.
- [ ] If integration is **enabled**, api startup **does not** crash (proves GET storage succeeded).

### Public URL policy

- [ ] For **private** data: `STORAGE_USE_DASHBOARD_PUBLIC_BASE=false` and empty `STORAGE_PUBLIC_BUCKETS` unless you intentionally expose buckets.
- [ ] If you enable dashboard public URLs, confirm nginx/Tools Dashboard actually serves those objects **without** breaking your security model.

### Compose / networking

- [ ] **`docker-compose.dev.yml`**: `api-server` has `extra_hosts` for `host.docker.internal` (and `dev.aiepic.app` if you call that host from the container).
- [ ] **`render-worker`** has the same `extra_hosts` if Seaweed URL uses `host.docker.internal`.
- [ ] **`NEXT_PUBLIC_API_URL`** is set for **`api-server`** in compose (dev + prd) so template resource rewriting matches the front.

### Functional smoke (manual)

- [ ] **S3:** Upload then download via API routes (or `test-s3` script if you use it).
- [ ] **Templates:** Save and load a template with an image; images load through **`/api/v1/template-textile/resource/...`** in the browser network tab.
- [ ] **Batch:** Upload a batch file; confirm parse job can read the file from Seaweed (Python subprocess env includes `SEAWEEDFS_*` and bucket **`repositories`** default when unset).

### Documentation in repo

- [ ] **`.env.dev.example`** / **`.env.prd.example`** aligned with your real secrets policy (never commit real keys).
- [ ] Re-read **`api-server/src/core/storage/index.ts`** after behavior changes so this tutorial stays mentally in sync.

---

## 4. Related paths (code)

| Area | Path |
|------|------|
| Storage contract + exports | `api-server/src/core/storage/index.ts` |
| Dashboard GET + URL resolution | `api-server/src/core/integrations/appLibraryStorageIntegration.ts` |
| Public API base for templates | `api-server/src/core/config/index.ts` → `publicApi.baseUrl` |
| S3 service | `api-server/src/features/s3-bucket/services/s3Service.ts` |
| Batch upload storage | `api-server/src/features/batch-upload/services/storageService.ts` |
| Python batch download | `api-server/batch-parsing/storage_client.py` |
| Dev compose | `docker-compose.dev.yml` |
| Prd compose | `docker-compose.prd.yml` |

---

## 5. Troubleshooting (short)

| Symptom | Likely cause |
|---------|----------------|
| API exits on startup after enabling integration key | Bad key, wrong `TOOLS_DASHBOARD_ORIGIN`, or dashboard unreachable from container (DNS/firewall). |
| `host.docker.internal` fails in container | Missing `extra_hosts: host.docker.internal:host-gateway` (Linux). |
| Batch parse cannot find file | Wrong `SEAWEEDFS_BUCKET` vs upload bucket; verify env on **api-server** and Python spawn env. |
| Template images broken in browser | Wrong `NEXT_PUBLIC_API_URL` / `API_PUBLIC_ENDPOINT` for where the browser reaches the API. |

---

## 6. See also

- **Generic Seaweed S3 integration** (any external app): [SEAWEEDFS_S3_INTEGRATION_FOR_EXTERNAL_APPS.md](./SEAWEEDFS_S3_INTEGRATION_FOR_EXTERNAL_APPS.md)
