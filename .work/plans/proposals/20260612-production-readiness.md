# Production Readiness — E-Cards (tools-ecards)

**Date:** 2026-06-12
**Status:** Applied

## Summary

Production-ready credentials and configuration applied to both dev and production environments for the E-Cards application. The companion Tools Dashboard (OAuth/identity) was already configured for production at `tools.aiepic.app`.

## Changes Applied

### 1. Credentials Generated (all via `openssl rand`)

| Credential | Value (truncated) | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | `d37291e5…` (48 hex) | Database auth, same in dev+prd |
| `JWT_SECRET` | `nRslVhFI…` (64 base64) | Token signing, same in dev+prd |
| `TOKEN_ENCRYPTION_KEY` | `710393f0…` (128 hex) | Session encryption, same in dev+prd |
| `REDIS_PASSWORD` (prd only) | `8a7df089…` (48 hex) | Redis auth in production |
| `EXTERNAL_API_KEY` | `me4EqxNB…` (44 base64) | Backend-to-backend auth, same in dev+prd |

### 2. Files Modified

| File | Changes |
|---|---|
| `.env` | Replaced 5 placeholder credentials with generated values. Kept all dev URLs (`localhost`, `dev.aiepic.app`), existing OAuth/application IDs |
| `.env.prd` | Replaced 8 placeholder values (same as dev + Redis password + DeepSeek API key + app-library key). Production URLs remain (`ecards.aiepic.app`, `tools.aiepic.app`) |
| `.env.prd.example` | Updated `REDIS_PASSWORD` placeholder from empty to `CHANGE_ME_REDIS_PASSWORD`, `SEAWEEDFS_BUCKET` to `CHANGE_ME_S3_BUCKET` |
| `docker-compose.dev.yml` | Redis service now supports `REDIS_PASSWORD` env var with conditional `--requirepass` (matching prd pattern) |

### 3. Verifications

| Check | Result |
|---|---|
| `docker compose -f docker-compose.dev.yml --env-file .env config` | ✅ Valid |
| `docker compose -f docker-compose.prd.yml --env-file .env.prd config` | ✅ Valid |
| `./bin/start.sh dev status` | ✅ Works |
| `./bin/start.sh prd status` | ✅ Works |
| Dev stack API health (`GET /health`) | ✅ `status: ok`, `env: development` |
| Dev stack frontend (`GET /`) | ✅ Serving "E-Cards Designer \| Tools Dashboard" |
| All dev containers healthy | ✅ 6/6 running (api-server, front-cards, postgres, cassandra, redis, render-worker) |
| No placeholder secrets in `.env` | ✅ 0 matches |
| No placeholder secrets in `.env.prd` | ✅ 0 matches |
| `.env.backup` preserved | ✅ Untouched |

## Remaining Items (not in scope, noted for future)

1. **TLS termination** — nginx listens on port 80; add certs or document LB handoff
2. **LLM API keys** — `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` still have placeholder values (user must provide real keys)
3. **Monitoring/alerting** — No Prometheus/Grafana/Datadog/Sentry configured
4. **Staging environment** — `docker-compose.stg.yml` and `.env.stg` don't exist (start.sh supports the alias)
5. **Cassandra host tuning** — `swapoff`, `vm.max_map_count`, JMX auth per `docs/CASSANDRA_PRODUCTION.md`
6. **Render-worker HEALTHCHECK** — Missing in `render-worker/Dockerfile.prd`
7. **Port conflicts** — Ports 80/443 already in use on this host (by tools-dashboard). E-Cards prd nginx needs `NGINX_HTTP_PORT` adjusted if co-hosted
8. **CPU limits** — Only `mem_limit` set, no `cpus` on any service
9. **Automated backups** — Scripts exist (`bin/start.sh`, `bin/start_cron.sh`) but no host cron or k8s CronJob wired
