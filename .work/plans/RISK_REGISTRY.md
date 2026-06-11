# RISK_REGISTRY - planning registry

**Updated:** 2026-04-27 · **Maintained by:** plan-foundation / plan-master

Status: **Open** | **Mitigated** | **Accepted** | **Closed**

| ID | Risk | Category | Likelihood | Impact | Mitigation | Status | Owner |
|----|------|----------|------------|--------|------------|--------|-------|
| R1 | Render worker rendering is mocked — BullMQ worker infra exists, Canvas/Sharp logic not implemented | execution | H | H | M1 milestone prioritized; replace mock with real Canvas/Sharp rendering | Open | eng |
| R2 | Batch import controller returns placeholder (routes mounted at `/api/batch-import`) | execution | M | M | M2 milestone; replace placeholder with real mapping logic | Open | eng |
| R3 | No CI/CD pipeline | process | M | M | M3-T1; platform choice needed first (U2) | Open | eng |
| R4 | Cassandra OOM in development | infra | M | M | Documented fixes in `.work/operations/fixes/from-claude/`; conservative heap settings in compose | Mitigated | eng |
| R5 | No test coverage baseline | quality | M | M | M3-T2; set 70% target on new code | Open | eng |
| R6 | External OAuth identity server dependency | dependency | M | M | This app is a client; auth server is separate repo | Accepted | eng |

## Review log

| Date | Reviewer | Action |
|------|----------|--------|
| 2026-04-27 | brownfield synthesis | Initial population from foundation docs |
