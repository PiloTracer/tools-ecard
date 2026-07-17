# MOD-06 AI amplification — uncommitted feedback UX + test runner

**Date:** 2026-07-16  
**Scope:** Operator feedback F4/F5/F6/F9/F12 + api-server jest DEBUG OOM workaround  
**AI-assisted:** yes  
**Source:** `@code-repair repair - from uncommitted`

## AI change risk summary
- AI-assisted: yes
- Boundaries crossed: 3 — front-cards (profile, designer clip/units/capitalize) · render-worker (clip + capitalize) · api-server (test runner only)
- New cross-boundary deps: none — shared capitalize lives in front-cards utils; worker keeps a local copy (no new package)
- Test isolation: ok — command: `docker compose -f docker-compose.dev.yml exec -T front-cards sh -c 'cd /app && npx jest --coverage=false --testPathPatterns=nameCapitalize'` and `… render-worker sh -c 'cd /app && npm test'` — `measured`
- Human architectural review: optional — reason: UX feedback + clipPath wiring; no auth/schema changes; package.json only changes `test` script
- Blast radius: If clipShape sync is wrong, designer preview disagrees with export/PNG. Person-name title case runs **only at first ingest** (Demo `mapRowToContactFields`; Normal `DataNormalizer.format_field`); export/render and record edits preserve stored casing. `business_name` / emails stay exempt. If `run-tests.cjs` mis-clears env, api-server jest could miss DEBUG-dependent behavior (unlikely). Profile page is read-only display of existing auth User fields.

## Recommendation
merge_with_conditions — reason: mechanical blast-radius stays elevated (multi-area) but touch-scope declares paths; re-verify uncommitted must be pass or pass-with-conditions before commit.

## Conditions if merge_with_conditions
- Do not commit `.reasonix/` (gitignored)
- front-cards + render-worker + api-server jest green in compose
- Live designer: changing Clip Shape updates preview without reload
- Owner acknowledges `api-server/package.json` test script change (already in touch-scope owner_approval)
