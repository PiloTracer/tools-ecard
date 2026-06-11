# ADR 005 — Docker Compose for all services

**Status:** Decided · 2026-04-27 (brownfield synthesis)
**Owner:** eng
**Supersedes:** -

## Context

The project runs 7 services (postgres, cassandra, redis, frontend, api, render-worker, db-init) that must work together consistently across development environments.

**Alternatives considered:**
- Host-native installs — version drift across machines, complex setup
- Kubernetes — overkill for single-developer/team dev environment
- Podman — Linux-only, less ecosystem support

## Decision

Use **Docker Compose** (`docker-compose.dev.yml`) for the local development stack, managed by `bin/start.sh` for interactive menu and CLI modes. Production uses `docker-compose.prd.yml`.

**Evidence:** `docker-compose.dev.yml` at repo root, `bin/start.sh` with dev/stg/prd environment support.

## Consequences

- **Positive:** Consistent environment across all developers
- **Positive:** `docker compose up` starts all 7 services with a single command
- **Positive:** Container names follow `tools_dashboard${TD_STACK_SUFFIX}-{service}` convention
- **Negative:** Docker resource usage (especially Cassandra with 2GB heap)
- **Negative:** Docker-in-Docker complications for host-based tools (OAuth callback URLs need host networking)
