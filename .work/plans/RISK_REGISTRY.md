# RISK_REGISTRY - planning registry

**Updated:** 2026-07-16 · **Maintained by:** plan-foundation / plan-master / session-control

Status: **Open** | **Mitigated** | **Accepted** | **Closed**

| ID | Risk | Category | Likelihood | Impact | Mitigation | Status | Owner |
|----|------|----------|------------|--------|------------|--------|-------|
| R1 | Render path incomplete — Fabric template JSON parse TODO | execution | H | H | Finish renderer element pipeline; keep M1 E2E doc honest | Open | eng |
| R2 | Batch import HTTP layer still placeholder messaging | execution | M | M | Replace controller placeholders; wire real status/cancel | Open | eng |
| R3 | No CI/CD pipeline | process | M | M | — | **Closed** 2026-07-16 | eng |
| R4 | Cassandra OOM in development | infra | M | M | Documented fixes; conservative heap in compose | Mitigated | eng |
| R5 | No test coverage baseline | quality | M | M | render-worker Jest thresholds 40% + CI `--coverage` | **Mitigated** 2026-07-16 | eng |
| R6 | External OAuth identity server dependency | dependency | M | M | Client-only; auth server separate | Accepted | eng |
| R7 | Fat-client local `.ai/` / `.ai.ui/` confuse agents | process | M | M | Thin-client pointers in `.cursorrules`; delete leftovers after confirm | Mitigated | owner |

## Review log

| Date | Reviewer | Action |
|------|----------|--------|
| 2026-04-27 | brownfield synthesis | Initial population |
| 2026-07-16 | session context verify | Closed R3; mitigated R5/R7; reopened honesty on R1/R2 from code |
