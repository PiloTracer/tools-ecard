# NEXT Archive - completed iterations

> **Context budget: history is moved, never deleted.** Session-start files stay lean; older material lives here, with a pointer line left in the live file.
> Moved out of `NEXT.md` on 2026-09-15 (bloat trim). Moved text is verbatim; original order preserved.
> Authoritative copy of this history also remains in git history prior to this change.

---

<!-- moved from NEXT.md L156-L199 -->
### Completed — FC: Font fidelity + fit fix (complete 2026-08-27)

Owner-approved plan `.work/plans/20260827-font-fidelity-fix-plan.md`. FC-T1 FontFace-awaited preload (exact variant, no swap, demo path too); FC-T2 width-only fit shrink; FC-T3 worker fontLoader via api-server catalog + registerFont (+ INTERNAL_API_URL in dev/prd/demo compose); FC-T4 worker fit parity (`computeFitScale`); FC-T5 baseline fonts in both worker Dockerfiles (+ prd fontconfig cache fix). Gates: front 70 suites/420, worker 8 suites/53 (0 skips post-rebuild), tsc clean, touch-scope pass, MOD-06 merge_ok; live Montserrat PNG probe + prd image build-verified. Not yet committed at FC close.

---

### Completed — FB: Field-binding & line-compaction reliability fix (complete 2026-08-27)

Owner-approved plan `.work/plans/20260827-field-binding-compaction-fix-plan.md`. FB-T1 fieldResolution module; FB-T2 new line-emptiness semantics + `requiredFields` gate + `linePriority` removed; FB-T3 batch export field report; FB-T4 render-worker parity (blank-on-missing, compaction port); FB-T5 property-panel UX; FB-T6 types/docs; FB-T7 gates (front 70 suites/408, worker 7 suites/37, tsc clean, touch-scope pass, MOD-06 merge_ok). Follow-up: `isEditing` boolean fix (`DesignCanvas.tsx:1687`). Committed + pushed 2026-08-27.

---

### Completed — M5: x-director recommended improvements

**Status:** complete · **Completed:** 2026-07-16

| ID | Description | Status |
|----|-------------|--------|
| M5-T1 | Playwright E2E smoke scaffold + CI job (live `next start`) | done |
| M5-T2 | Render-worker Fabric JSON → PNG (text/shapes/images/QR + job storageUrl) | done |
| M5-T3 | Parser golden fixtures (Demo + Python parity) | done |
| M5-T4 | Ops runbook: diagnostics, monitoring, cutover checklist | done |
| M5-T5 | Front-cards TS errors fixed; coverage floor 30% interim | done |
| M5-T6 | fake-indexeddb demo template persistence unit test | done |
| M5-T7 | Render-status API returns storageUrl from completed jobs | done |

---

### Prior iteration — M4: Demo mode + production restore-from-backup (complete)

**Milestone ref:** M4 · **SPEC:** `.work/features/demo-local-persistence/20260716-SPEC.md`  
**Status:** complete · **Completed:** 2026-07-16

| ID | Description | Status |
|----|-------------|--------|
| M4-T1 | Ops: prd restore-from-backup runbook + env verify helper | done |
| M4-T2 | Demo mode detection + provider + `/demo` route + banner | done |
| M4-T3 | Browser store layer (localStorage + IndexedDB) | done |
| M4-T4 | Demo adapters: projects + templates + resources | done |
| M4-T5 | Demo adapters: fonts + batches/records (render mocked) | done |
| M4-T6 | Auth bypass + api-server DEMO_MODE write guard | done |
| M4-T7 | Tests + lint/tsc in compose + MOD-06 + CHANGELOG | done |
| M4-verify | Public-Demo barriers (apiClient + Next BFF) | done |


---
