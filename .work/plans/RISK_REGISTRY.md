# RISK_REGISTRY - planning registry

**Updated:** 2026-08-12 · **Maintained by:** plan-foundation / plan-master / session-control

Status: **Open** | **Mitigated** | **Accepted** | **Closed**

| ID | Risk | Category | Likelihood | Impact | Mitigation | Status | Owner |
|----|------|----------|------------|--------|------------|--------|-------|
| R1 | Render path incomplete — Fabric template JSON parse TODO | execution | H | H | Finish renderer element pipeline; keep M1 E2E doc honest | Open | eng |
| R2 | Batch import HTTP layer still placeholder messaging | execution | M | M | Pass 3 (2026-08-12): real preview/mapping/preset endpoints on the mounted Fastify router `/api/batch-import` + `--mapping` parser override | **Closed** 2026-08-12 | eng |
| R3 | No CI/CD pipeline | process | M | M | — | **Closed** 2026-07-16 | eng |
| R4 | Cassandra OOM in development | infra | M | M | Documented fixes; conservative heap in compose | Mitigated | eng |
| R5 | No test coverage baseline | quality | M | M | render-worker Jest thresholds 40% + CI `--coverage` | **Mitigated** 2026-07-16 | eng |
| R6 | External OAuth identity server dependency | dependency | M | M | Client-only; auth server separate | Accepted | eng |
| R7 | Fat-client local `.ai/` / `.ai.ui/` confuse agents | process | M | M | Thin-client pointers in `.cursorrules`; delete leftovers after confirm | Mitigated | owner |
| R8 | Demo path accidentally writes to API/S3 | security | M | H | Dual client adapters + server `DEMO_MODE` write guard | Mitigated | eng |
| R9 | SeaweedFS not in tar.gz backup → incomplete restore | ops | H | H | Document separate S3 backup; restore warning in start.sh + runbook | Open | eng |
| R10 | Browser storage quota breaks large Demo templates | quality | M | M | Clear Demo Data + IndexedDB; document limits in banner | Open | eng |
| R11 | `app_roles` JWT claim staleness ≤1h after role revoke | security | M | M | Claim used for rendering only; all global-template mutations re-validate via `validate-token` (authoritative) | **Mitigated** 2026-08-12 | eng |
| R12 | vCard dialect drift (2.1 QP/charsets, 3.0, 4.0 variants) | quality | M | M | Per-version fixtures + py↔ts parity goldens; unknown properties preserved in `extra` | **Mitigated** 2026-08-12 | eng |
| R13 | Transposed-XLSX detection false positives on narrow sheets | quality | M | L | Orientation chosen only on clear score margin (≥3 and strictly greater); ambiguous → horizontal (status quo) | **Mitigated** 2026-08-12 | eng |
| R14 | Bundled-globals manifest stale after operator drops files | ops | M | L | Regenerator script scans directory; runbook documents the step; loader tolerates missing/corrupt entries | Open | eng |
| R15 | Global-template mutations unavailable when dashboard validate-token is down (fail-closed) | dependency | L | M | Deliberate fail-closed (503); regular templates unaffected; monitor dashboard availability | Accepted | eng |

## Review log

| Date | Reviewer | Action |
|------|----------|--------|
| 2026-04-27 | brownfield synthesis | Initial population |
| 2026-07-16 | session context verify | Closed R3; mitigated R5/R7; reopened honesty on R1/R2 from code |
| 2026-07-16 | M4 Demo plan | R8 mitigated by design; R9/R10 opened |
| 2026-08-12 | import-ux-templates plan (Passes 0–6) | Closed R2 (Pass 3 real endpoints); opened R11–R15 from plan §6 |
