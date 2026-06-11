# ADR 001 — Monorepo architecture (3 apps + shared packages)

**Status:** Decided · 2026-04-27 (brownfield synthesis)  
**Owner:** eng  
**Supersedes:** -

## Context

The tools-ecards project spans three distinct runtime concerns: a user-facing UI, an API server, and a background worker. These could be in separate repositories or a monorepo.

**Alternatives considered:**
- Multi-repo (separate repos per service) — higher coordination overhead
- Monolith (single deployable) — simpler but couples UI, API, and worker scaling

## Decision

Use a **monorepo** with three application directories (`front-cards/`, `api-server/`, `render-worker/`) and a shared `packages/` directory for common types.

**Evidence:** Existing code tree at repo root.

## Consequences

- **Positive:** Single `docker compose` stack for development; shared types in `packages/shared-types/`; atomic commits across services
- **Negative:** Build tooling must respect service boundaries; CI must avoid rebuilding all services on every change
- **Negative:** Package manager hoisting can cause cross-service dependency leaks
