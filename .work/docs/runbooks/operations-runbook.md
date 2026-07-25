# Operations Runbook — tools-ecards

**Last updated:** 2026-07-16

## Stack lifecycle

### Start

```bash
# Development stack (interactive menu)
./bin/start.sh dev

# Or direct CLI mode
./bin/start.sh dev up

# With specific services (faster startup when DBs already running)
docker compose -f docker-compose.dev.yml up -d frontend api render-worker
```

### Stop

```bash
./bin/start.sh dev down
# Or
docker compose -f docker-compose.dev.yml down
```

### Restart a single service

```bash
docker compose -f docker-compose.dev.yml restart render-worker
docker compose -f docker-compose.dev.yml restart api
docker compose -f docker-compose.dev.yml restart frontend
```

### View logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Single service
docker compose -f docker-compose.dev.yml logs -f render-worker
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f frontend

# Tail last N lines
docker compose -f docker-compose.dev.yml logs --tail=50 render-worker
```

## Health checks

### API server

```bash
curl http://localhost:7400/health
# Expected:
# { "status": "ok", "timestamp": "...", "env": "development", "appLibraryStorage": {...} }
```

### Render worker

```bash
# Check if render-worker is running and consuming the queue
docker compose -f docker-compose.dev.yml logs render-worker --tail=10
# Expected: "Render worker ready (env=development, concurrency=4)"
```

### Databases

```bash
# PostgreSQL
docker compose exec postgres pg_isready -U ecards_user -d ecards_db

# Redis
docker compose exec redis redis-cli ping
# Expected: PONG

# Cassandra
docker compose exec cassandra cqlsh -e "describe cluster"
```

## Common issues and fixes

### Cassandra OOM

**Symptom:** Cassandra container exits with OutOfMemoryError.
**Fix:** Heap is limited to 2G in `docker-compose.dev.yml`. If still OOM, reduce to 1G:

```yaml
# In docker-compose.dev.yml cassandra section:
MAX_HEAP_SIZE: ${CASSANDRA_MAX_HEAP_SIZE:-1G}
```

**Background:** See `.work/operations/fixes/from-claude/` for Cassandra fix history.

### Render worker not processing jobs

**Symptom:** Jobs stay in "waiting" state, worker logs show nothing.
**Troubleshooting:**

```bash
# 1. Check if worker is running
docker compose ps render-worker

# 2. Check Redis connectivity
docker compose exec redis redis-cli ping

# 3. Check worker logs
docker compose logs render-worker --tail=20

# 4. Verify queue exists
docker compose exec redis redis-cli EXISTS "bull:card-rendering:id"
```

### Port conflicts

| Service | Host port | Container port |
|---------|-----------|---------------|
| front-cards | 7300 | 3000 |
| api-server | 7400 | 4000 |
| PostgreSQL | 7432 | 5432 |
| Cassandra | 7042 | 9042 |
| Redis | 7379 | 6379 |

If any host port is in use, set the corresponding `*_HOST_PORT` env var in `.env`.

### Prisma schema changes

```bash
# Generate Prisma client after schema changes
docker compose exec api bash -c "cd /app && npm run db:generate"

# Apply schema changes to dev DB
docker compose exec api bash -c "cd /app && npm run db:push"

# Create a migration
docker compose exec api bash -c "cd /app && npm run db:migrate"
```

## Deployment

### Production overview

Production uses [`docker-compose.prd.yml`](../../../docker-compose.prd.yml) + root [`.env.prd`](../../../.env.prd) (from [`.env.prd.example`](../../../.env.prd.example)) and [`bin/start.sh`](../../../bin/start.sh) with target `prd`. The public **demo** is a separate co-located stack: [`docker-compose.demo.yml`](../../../docker-compose.demo.yml) + root `.env.demo`, driven with target `demo` — see § Dual-stack on one host below.

The stack **does not ship a reverse proxy**. It publishes two loopback ports only — `front-cards` on `127.0.0.1:${FRONTEND_HOST_PORT}` and `api-server` on `127.0.0.1:${API_HOST_PORT}` (prd: **7500/7600**; demo: **7300/7400**) — and the **server's own nginx** terminates TLS and proxies to both. See § Production cutover (host nginx + TLS).

### Dual-stack on one host (prd + demo)

Both stacks run side-by-side on the same host. Isolation is entirely name/port-based — nothing is shared:

| Concern | prd (real production) | demo (public demo) |
|---------|----------------------|--------------------|
| Compose file / env | `docker-compose.prd.yml` / `.env.prd` | `docker-compose.demo.yml` / `.env.demo` |
| `TD_STACK_SUFFIX` | `_prd_tcrd` | `_demo_tcrd` |
| Compose project | `tools_dashboard_prd_tcrd` | `tools_dashboard_demo_tcrd` |
| Containers | `tools_dashboard_prd_tcrd-*` | `tools_dashboard_demo_tcrd-*` |
| Network | `…_ecards-prd` | `…_ecards-demo` |
| Volumes | `*_prd_data` | `*_demo_data` |
| Loopback ports (front/api) | `7500` / `7600` | `7300` / `7400` |
| Public site | `ecards.aiepic.app` (`deploy/nginx/ecards-prd-host.conf`) | `ecards-demo.aiepic.app` (`deploy/nginx/ecards-host.conf`) |
| `DEMO_MODE` | `false` (enforced by verify) | `true` (enforced by verify) |

Operations:

```bash
./bin/start.sh prd up          # production stack
./bin/start.sh demo up         # demo stack (same commands: up/up-build/down/logs/status/…)
bash bin/verify-prd-env.sh .env.prd prd     # must exit 0; fails if DEMO_MODE=true
bash bin/verify-prd-env.sh .env.demo demo   # must exit 0; fails if DEMO_MODE=false
./bin/refresh-prd.sh           # targeted prd refresh (default: front-cards only)
./bin/refresh-demo.sh          # same, for the demo stack (= refresh-prd.sh demo)
```

**Migration note (one-time, when the demo used to run as the `_prd_tcrd` project):** the old demo's volumes are named `tools_dashboard_prd_tcrd_*_prd_data`. If production must start clean, remove them before the first `prd up` (`docker volume rm tools_dashboard_prd_tcrd_postgres_prd_data tools_dashboard_prd_tcrd_redis_prd_data tools_dashboard_prd_tcrd_cassandra_prd_data`); if the old demo data should be kept, clone it into the demo names first, e.g. `docker run --rm -v tools_dashboard_prd_tcrd_postgres_prd_data:/from -v tools_dashboard_demo_tcrd_postgres_demo_data:/to busybox sh -c 'cp -a /from/. /to/'` (repeat for redis/cassandra), then remove the old volumes.

Compose project / volume names come from `.env.prd` (`COMPOSE_PROJECT_NAME`, typically `tools_dashboard_prd_tcrd`). Volume backups live under:

```text
/data/backups_<COMPOSE_PROJECT_NAME>/
  .latest
  pg_<TIMESTAMP>.tar.gz
  redis_<TIMESTAMP>.tar.gz
  cassandra_<TIMESTAMP>.tar.gz   # optional but recommended
```

**SeaweedFS / S3 is external** and is **not** included in these tar.gz archives. Back up object storage separately before relying on a restore for templates and generated cards.

### Host tuning (before first prd up)

```bash
sudo sysctl -w vm.overcommit_memory=1
echo "vm.overcommit_memory=1" | sudo tee -a /etc/sysctl.conf

sudo sysctl -w vm.max_map_count=1048575
echo "vm.max_map_count=1048575" | sudo tee -a /etc/sysctl.conf

sudo swapoff -a
# Also comment out swap lines in /etc/fstab
```

### Path A — Fresh production (empty volumes)

1. Clone/copy the repo onto the host (same compose + `bin/start.sh` revision you intend to run).
2. `cp .env.prd.example .env.prd` and replace every `CHANGE_ME_*` secret (OAuth, DB, Redis, JWT, SeaweedFS, etc.).
3. Align public URLs: `API_URL`, `NEXT_PUBLIC_API_URL`, `CORS_ALLOWED_ORIGINS`, `OAUTH_REDIRECT_URI`.
4. Verify env: `bash bin/verify-prd-env.sh .env.prd` (must exit 0).
5. Apply host tuning above.
6. Start: `./bin/start.sh prd up` (builds and waits for API health).
7. Confirm both loopback upstreams: `curl -sS http://127.0.0.1:<API_HOST_PORT>/health` and `curl -sSI http://127.0.0.1:<FRONTEND_HOST_PORT>/`.
8. Install the host nginx site and certificates — see § Production cutover (host nginx + TLS) — then hit the public HTTPS URL.

Optional **Demo deploy** (no durable user data on server): use the dedicated demo stack (`./bin/start.sh demo up`) described in § Dual-stack on one host — it carries `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true` in `.env.demo`. **Both flags are mandatory** for a public internet Demo. `/demo` alone is not enough for legal/security guarantees.

### Path B — Restore production from `start.sh` tar.gz backups

Use when migrating hosts or recovering Postgres/Redis/Cassandra volumes.

1. On the **source** host (stack previously healthy):

   ```bash
   ./bin/start.sh prd backup
   # Archives written to /data/backups_<COMPOSE_PROJECT_NAME>/
   ls -lh /data/backups_<COMPOSE_PROJECT_NAME>/
   ```

2. Copy the backup set to the **target** host (preserve names):

   ```bash
   # Example — adjust COMPOSE_PROJECT_NAME to match .env.prd on the target
   sudo mkdir -p /data/backups_tools_dashboard_prd_tcrd
   scp pg_*.tar.gz redis_*.tar.gz cassandra_*.tar.gz .latest \
     user@target:/data/backups_tools_dashboard_prd_tcrd/
   ```

3. On the **target** host: install the same repo revision, create `.env.prd` (same `COMPOSE_PROJECT_NAME` / volume naming as the backup dir), run `bash bin/verify-prd-env.sh .env.prd`.

4. Restore volumes and bring the stack up (destructive to existing named volumes):

   ```bash
   ./bin/start.sh prd restore
   ```

   This stops the stack, recreates `postgres_prd_data` / `redis_prd_data` / `cassandra_prd_data`, extracts the matching tar.gz files, then `up --build`. Confirm the SeaweedFS warning in the script output — restore object storage out of band if needed.

5. Health-check the loopback upstreams and the public URL as in Path A.

### Production cutover (host nginx + TLS)

The public entry point is the server's nginx, installed and renewed on the host. Certificates are issued by certbot (Let's Encrypt) directly on the server — no Cloudflare-issued origin certificate is involved.

This section uses the demo site as the example. For the **production** site, repeat the same steps with `deploy/nginx/ecards-prd-host.conf` (installed as `ecards.aiepic.app.conf`) and `-d ecards.aiepic.app` — the two sites coexist (distinct upstream/map names, distinct ports 7500/7600). The prd stack must be running first (`./bin/start.sh prd up`), and `https://ecards.aiepic.app/oauth/complete` must be registered with the IdP.

1. Install the site and reload nginx:

   ```bash
   sudo cp deploy/nginx/ecards-host.conf /etc/nginx/sites-available/ecards-demo.aiepic.app.conf
   sudo ln -s /etc/nginx/sites-available/ecards-demo.aiepic.app.conf /etc/nginx/sites-enabled/
   sudo mkdir -p /var/www/certbot
   sudo nginx -t && sudo systemctl reload nginx
   ```

   `nginx -t` fails until the certificate files exist. Either run step 2 first with the 443 block commented out, or use `certbot --nginx`, which writes a temporary config for you.

2. Issue the certificate. **The hostname is proxied through Cloudflare (orange cloud), which breaks the HTTP-01 challenge unless port 80 reaches this host.** Two working options:

   - **DNS-01 (works with the proxy on):** create a Cloudflare API token scoped to `Zone:DNS:Edit` for the zone, store it at `/root/.secrets/cloudflare.ini` (`chmod 600`), then:

     ```bash
     sudo certbot certonly --dns-cloudflare \
       --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
       -d ecards-demo.aiepic.app
     ```

   - **HTTP-01 (grey-cloud during issuance):** set the DNS record to "DNS only" in Cloudflare, wait for propagation, then:

     ```bash
     sudo certbot certonly --webroot -w /var/www/certbot -d ecards-demo.aiepic.app
     ```

     Re-enable the proxy afterwards. Renewals will fail while proxied, so prefer DNS-01 for an unattended host.

3. With the proxy on, set the Cloudflare SSL/TLS mode to **Full (strict)**. "Flexible" would make Cloudflare talk plain HTTP to port 80, which this config answers with a 301 redirect — that produces a redirect loop.

4. Verify renewal is unattended: `sudo certbot renew --dry-run` and `systemctl list-timers | grep certbot`.

5. Verify end to end:

   ```bash
   curl -sSI https://ecards-demo.aiepic.app/            # 200 from Next.js
   curl -sS  https://ecards-demo.aiepic.app/health      # API health JSON
   ```

6. If the hostname stays proxied, install `deploy/nginx/ecards-cloudflare-realip.conf` into `/etc/nginx/snippets/` and uncomment the matching `include` — otherwise every access-log line records a Cloudflare edge IP.

### Path C — Backup only (no restore)

```bash
./bin/start.sh prd backup
```

Stack is stopped briefly for a consistent volume snapshot, archives are written, then the stack is restarted. Retention: archives older than 7 days are deleted by `start.sh`.

### Demo mode (ops note) — public internet Demo

| Flag | Where | Effect |
|------|-------|--------|
| `DEMO_MODE=true` | api-server **and** front-cards env | **Required for public Demo.** Rejects mutating `/api/*` with `demo_mode_readonly` (api-server + Next BFF before body forward) |
| `NEXT_PUBLIC_DEMO_MODE=true` | front-cards | Forces Demo UI + browser repositories for all visitors |
| `/demo` or `?demo=1` | browser only | Sets `localStorage` flag — **not sufficient alone** for a public legal Demo |

**Hard rule for internet-facing Demo hosts:** set **both** `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`. Do not rely on `/demo` alone — without the env flags, a missed client path could still POST to the API.

Defense layers (all required for “user content never persists on the server”):
1. Service adapters + `apiClient` refuse mutating calls when Demo is on (browser never sends write bodies).
2. Next.js BFF rejects mutating methods when Demo env is on **before** buffering/forwarding the body to api-server.
3. api-server `demoModeGuard` rejects mutating `/api` with `403 demo_mode_readonly`.

See SPEC `.work/features/demo-local-persistence/20260716-SPEC.md`.

## Host Tuning

(See **Host tuning** under Production above.)

## Monitoring

### Render job status API

```bash
curl http://localhost:7400/api/batches/:batchId/records/:recordId/render-status
# Returns: { status: "active"|"completed"|"failed", progress: 0-100 }
```

## Diagnostics API (U6)

Operational endpoints for queue health and render job status. All require an authenticated session unless noted.

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | API liveness + storage mode summary |
| `GET /api/diagnostics/queue-stats` | BullMQ queue depth / job counts |
| `GET /api/batches/:batchId/records/:recordId/render-status` | Per-record render progress |

```bash
# Queue stats (authenticated)
curl -b cookies.txt http://localhost:7400/api/diagnostics/queue-stats

# Render status for a batch record
curl -b cookies.txt http://localhost:7400/api/batches/BATCH_ID/records/RECORD_ID/render-status
```

## Monitoring and alerting (recommended)

| Layer | Tool | Notes |
|-------|------|-------|
| Errors | Sentry (or similar) | Wire `SENTRY_DSN` in api-server, front-cards, render-worker when ready |
| Metrics | Prometheus + Grafana | Scrape `/health` and queue-stats; chart render-worker job latency |
| Logs | `docker compose logs -f` | Ship to Loki/CloudWatch in production |
| Uptime | External ping | Hit `https://<host>/health` every 60s |

## Production cutover checklist

1. Copy `.env.prd.example` → `.env.prd`; run `bin/verify-prd-env.sh .env.prd prd` (must pass).
2. Confirm DNS A/AAAA records point to the host running nginx.
3. TLS certificates installed (Let's Encrypt or operator-provided).
4. For the **Demo** internet site: use the dedicated demo stack — `.env.demo` with `DEMO_MODE=true` / `NEXT_PUBLIC_DEMO_MODE=true`, `./bin/start.sh demo up` (see § Dual-stack on one host).
5. `./bin/start.sh prd up` — wait for postgres/redis/cassandra healthy.
6. Smoke test: `curl https://<host>/health`, login, upload batch, export one card.
7. Enable volume backups: `bin/start_cron.sh` (dev) or operator cron for prd volume tars under `/data/backups_<COMPOSE_PROJECT_NAME>/`.
8. Document on-call: link to this runbook + recent deploy SHA.

## Automated dev backups

```bash
./bin/start_cron.sh dev
# Installs a daily 01:00 cron that tars postgres/redis/cassandra volumes.
```

