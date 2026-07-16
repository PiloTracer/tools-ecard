# UNKNOWNS - planning registry

**Updated:** 2026-07-16 · **Maintained by:** plan-foundation / plan-master / session-control

| ID | Question / blocker | Blocks | Owner | Status |
|----|-------------------|--------|-------|--------|
| U1 | Stack pins not finalized in DOCS_TECH_STACK.md | docs polish | owner | **Resolved** 2026-07-16 — DOCS_TECH_STACK documents Next 16, PG 16, Redis, Cassandra, ports, env identity (not lockfile-exact pins) |
| U2 | CI platform choice | M3-T1 | eng | **Resolved** 2026-07-16 — GitHub Actions `.github/workflows/ci.yml` (5 jobs) |
| U3 | Is the project in active development or maintenance mode? | Priority decisions | owner | **Resolved** 2026-07-16 — active-dev for M4 (Demo + prod restore) per plan ack |
| U4 | What is the production deployment target? | Ops / deploy | owner | **Resolved** 2026-07-16 — procedure via `.env.prd` + `docker-compose.prd.yml` + `./bin/start.sh prd` (host/DNS still operator-owned; see runbook) |
| U5 | What test coverage targets are acceptable? | M3-T2 | eng | **Resolved** 2026-07-16 — `render-worker/jest.config.js` global thresholds 40% branches/functions/lines/statements; CI runs `--coverage` |
| U6 | Diagnostics routes at `/api/diagnostics` undocumented | Documentation | eng | Open |

## Review log

| Date | Reviewer | Action |
|------|----------|--------|
| 2026-04-27 | brownfield synthesis | Initial population from foundation docs |
| 2026-07-16 | session context verify | Resolved U1/U2/U5 from repo evidence; left U3/U4/U6 open |
| 2026-07-16 | M4 Demo plan | Resolved U3/U4 for procedure; U6 still open |
