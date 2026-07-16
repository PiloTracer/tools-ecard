# ADR 007 — Demo mode browser persistence (no server writes)

**Status:** Decided · 2026-07-16  
**Owner:** eng  
**Supersedes:** -

## Context

Product needs a **Demo** deploy/path where users can exercise the designer and related workflows **without any durable data landing on the server** (Postgres, Cassandra, Redis queues, SeaweedFS). Anything that would normally be persisted must live in the browser.

**Alternatives considered:**
- Server-side ephemeral DB wiped on restart — still writes to the host; fails the “no data on the actual server” requirement.
- MSW-only mocks without a real store — cannot survive refresh or support real UX.
- Pure `localStorage` for everything — quota (~5MB) cannot hold fonts/images/template packages.

## Decision

1. **Client repository adapters** under `front-cards/features/demo/` intercept persistence at service boundaries (`projectService`, `templateService`, `fontService`, `batchService`, etc.).
2. **Hybrid Web Storage:** `localStorage` for small JSON domain records + control flags (`ecards:demo:*`); **IndexedDB** for binary assets (extend / parallel to `browserStorageService`).
3. **Activation:** `NEXT_PUBLIC_DEMO_MODE=true` / `DEMO_MODE=true` forces Demo for a host; `/demo` (or `?demo=1`) enables client Demo via `localStorage`.
4. **Auth:** synthetic local demo user; skip OAuth; no API session cookies required.
5. **Server guarantee:** when `DEMO_MODE=true`, api-server rejects mutating methods on `/api/*` with `demo_mode_readonly`.
6. **No Prisma / Cassandra schema** for Demo — zero server persistence model.

## Consequences

- **Positive:** True zero-persistence Demo; works offline after first load of static assets; dual client+server ban reduces accidental writes.
- **Negative:** IndexedDB required for realistic assets (documented; not pure localStorage).
- **Negative:** Batch render remains mocked/client-preview in Demo v1 (no BullMQ/S3 output).
- **Negative:** Demo data is per-browser and not portable across devices unless export is added later.
