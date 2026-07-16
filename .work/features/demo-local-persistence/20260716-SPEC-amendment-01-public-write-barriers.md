# SPEC amendment 01 — Demo public-host write barriers

**Base SPEC:** `20260716-SPEC.md`  
**Date:** 2026-07-16  
**Purpose of amendment:** Close defense gaps found in x-director security verify for internet-facing Demo.

## Binding changes

1. **R10 (new):** Public Demo hosts MUST set `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`. `/demo` localStorage alone is insufficient for legal/security guarantees.
2. **R11 (new):** `ApiClient` post/put/patch/delete MUST throw `demo_mode_readonly` when `isDemoMode()` is true — before any network I/O.
3. **R12 (new):** Next.js BFF proxy (`proxyRequestToApiServer`) MUST reject mutating methods when server Demo env is on **before** buffering or forwarding the request body to api-server.
4. **R6 (clarified):** api-server `demoModeGuard` remains the third barrier for any request that reaches api-server.

## SPEC sections affected

§4 Behavioural spec · §7 Invariants · §12 Rollout · §14 Implementation map

## Evidence

- Verify audit 2026-07-16 (x-director / engineering+security)
- Files: `front-cards/shared/lib/api-client.ts`, `front-cards/shared/server/proxy-to-api-server.ts`, `api-server/src/core/middleware/demoModeGuard.ts`
