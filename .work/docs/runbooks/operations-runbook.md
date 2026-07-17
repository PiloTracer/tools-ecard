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

Production uses [`docker-compose.prd.yml`](../../../docker-compose.prd.yml) + root [`.env.prd`](../../../.env.prd) (from [`.env.prd.example`](../../../.env.prd.example)) and [`bin/start.sh`](../../../bin/start.sh) with target `prd`. Nginx terminates HTTP on the host (`NGINX_HTTP_PORT`, default 80).

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
7. Confirm: `curl -sS http://127.0.0.1:<API_HOST_PORT>/health` (API is loopback-bound in prd) and hit the public nginx URL.

Optional **Demo deploy** (no durable user data on server): set **`DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`** in `.env.prd`, then up. **Both flags are mandatory** for a public internet Demo. `/demo` alone is not enough for legal/security guarantees.

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

5. Health-check API and nginx as in Path A.

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

1. Copy `.env.prd.example` → `.env.prd`; run `bin/verify-prd-env.sh` (must pass).
2. Confirm DNS A/AAAA records point to the host running nginx.
3. TLS certificates installed (Let's Encrypt or operator-provided).
4. For **Demo** internet cutover: set `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`; start with empty volumes.
5. `./bin/start.sh prd up` — wait for postgres/redis/cassandra healthy.
6. Smoke test: `curl https://<host>/health`, login, upload batch, export one card.
7. Enable volume backups: `bin/start_cron.sh` (dev) or operator cron for prd volume tars under `/data/backups_<COMPOSE_PROJECT_NAME>/`.
8. Document on-call: link to this runbook + recent deploy SHA.

## Automated dev backups

```bash
./bin/start_cron.sh dev
# Installs a daily 01:00 cron that tars postgres/redis/cassandra volumes.
```

