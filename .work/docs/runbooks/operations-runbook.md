# Operations Runbook — tools-ecards

**Last updated:** 2026-04-27

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

### Production

## Host Tuning

Required sysctl settings on the Docker host before production deployment:

```bash
# Redis — prevent background save failures under low memory
sudo sysctl -w vm.overcommit_memory=1
echo "vm.overcommit_memory=1" | sudo tee -a /etc/sysctl.conf

# Cassandra — prevent OOM under load (memory-mapped files)
sudo sysctl -w vm.max_map_count=1048575
echo "vm.max_map_count=1048575" | sudo tee -a /etc/sysctl.conf

# Cassandra — disable swap (degrades performance)
sudo swapoff -a
# Also comment out swap lines in /etc/fstab
```

Production deployment uses `docker-compose.prd.yml` with an Nginx proxy. See remote server reference at `.work/docs/from-claude-remote-server/` for the production topology (`dev.aiepic.app`).

```bash
./bin/start.sh prd up
```

## Monitoring

### Render job status API

```bash
curl http://localhost:7400/api/batches/:batchId/records/:recordId/render-status
# Returns: { status: "active"|"completed"|"failed", progress: 0-100 }
```

### Queue diagnostics

```bash
curl http://localhost:7400/api/diagnostics/queue-stats
```
