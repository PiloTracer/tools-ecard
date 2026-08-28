# Uncommitted changes review — FC (font fidelity + fit) & GD (geometry persistence)

**Date:** 2026-08-27
**Requested via:** `@x-director` — "analyze all the uncommitted changes, make sure there are no gaps or smells or issues. Provide detailed report with all findings, just a report, do not change any code yet."
**Scope:** full working tree vs `HEAD` (76a561a) — 22 modified + 6 untracked files (~1021+/169−), all covered by `.work/touch-scope` (verified: zero changed files outside `allowed_paths`).
**Method:** independent gate re-run in dev compose; two isolated review passes (general correctness + security); first-hand verification of every High/Medium finding; plan-vs-implementation traceability; eslint/touch-scope cross-checks.
**Verdict:** implementation is coherent, gates reproduce, no blocking defect found. **4 should-fix items** (1 high-scope gap, 1 medium robustness, 1 dead-code landmine, 1 worker/browser parity divergence) + **1 pre-existing security HIGH newly relied upon** + hardening notes. No code changed.

---

## 1. Independent gate re-run (dev compose, all claims reproduced)

| Gate | HANDOFF claim | Independent re-run | Result |
|------|---------------|--------------------|--------|
| front jest | 71 suites / 425 passed | **71 passed / 71** (425/425) | ✅ |
| front `tsc --noEmit` | exit 0 | **exit 0** | ✅ |
| api jest | 25 suites / 213 pass + 3 skip | **25 suites / 213 pass + 3 skip** | ✅ |
| worker jest | 8 suites / 54 passed | **8 suites / 54 passed** | ✅ |
| eslint touched files | "0 NEW errors" | 122 problems (103 err / 19 warn) on 9 files — **all pre-existing**: HEAD and working tree both contain exactly 4 `as any`/`any[]` in `templateService.ts`; the 3 `exportService.ts` warnings match FC's "3 pre-existing warnings" claim; zero added lines contain `any` in either diff | ✅ (claim holds) |
| touch-scope | pass | zero changed/untracked files outside `allowed_paths` | ✅ |

Note: containers run `/bin/sh` (no bash); `docker compose exec -T <svc> sh -c` was used.

---

## 2. Plan-vs-implementation traceability

| Task | Status | Evidence |
|------|--------|----------|
| FC-T1 browser preload awaits exact FontFace | ✅ | `fontService.ts:115-124`, `demoFontRepository.ts:29-37` — `new FontFace(...,{weight,style}).load()` + `document.fonts.add()`; jsdom fallback kept; `font-display: swap` removed |
| FC-T2 fit shrinks only on horizontal overflow | ✅ | `exportService.ts:416-423` — top/bottom violations warn-only; clamp [0.5,1], never upscale |
| FC-T3 worker `fontLoader.ts` + `INTERNAL_API_URL` | ✅ | new file; config default + dev/prd/demo compose env; auth contract matches `fontRoutes.ts:13-21`; catalog retry on transient failure (`:120-122`) |
| FC-T4 worker fit parity (`computeFitScale`) | ✅ | `fabricTemplateRenderer.ts`; clamp tested |
| FC-T5 Dockerfiles font packages | ✅ | dev: `fontconfig ttf-dejavu ttf-liberation`; prd: `fonts-dejavu fonts-liberation` + `fc-cache -f` + `XDG_CACHE_HOME=/tmp/.cache` for non-root user; `INTERNAL_API_URL` port wiring consistent (`api-server` container listens on `${API_INTERNAL_PORT:-4000}`, compose sets the same) |
| FC-T6 gates/docs/MOD-06 | ✅ | `BATCH-EXPORT-IMPLEMENTATION.md` +"Font & Fit Guarantees" contract matches code exactly; gates reproduced (§1) |
| GD-T1 identity-keyed save | ⚠️ | implemented (`templateController.ts:62`, service id>name>new resolution) — **but see Finding H-1** (resolution searches a paged list, breaks >20 templates) |
| GD-T2 twin prevention | ✅ (documented deviation) | `listTemplates` local merge dedupes, server wins + warn; dedupe key is **name-only** (no projectId on metadata — documented); local saves marked `unsynced` |
| GD-T3 canvas-authoritative geometry | ✅ | `CanvasControls.tsx:114-235` folds per-type effective dimensions (text fontSize when scaled, image exact scale, QR width/height/size, shapes radius/rx/ry); mismatch → `console.error`, never blocks save |
| GD-T4 desync fixes | ✅ | `DesignCanvas.tsx:292-316` ActiveSelection per-child fold; `:2145-2147` QR placeholder map-miss evicts stale objects |
| GD-T5 worker `drawQr` width/height parity | ✅ | `fabricTemplateRenderer.ts` `width ?? size` / `height ?? size` + drawImage-dest-rect test (120×60 asserted) |
| GD-T6 gates/MOD-06/carriers | ✅ | reproduced §1 |

---

## 3. Findings

### High

- **H-1 (scope gap in GD-T1) — `api-server/.../unifiedTemplateStorageService.ts:136`:** the id/name resolution calls `templateOperations.listTemplates(userId)` with **default paging page 1 / pageSize 20** (`core/prisma/client.ts:103-104,132-133`). A user with >20 templates doing an in-place save of a template that is not in the first page gets `existingTemplate = null` → **fresh uuidv4 + new blob + duplicate row** — precisely the stale-twin failure GD-T1 was built to eliminate. Fix (deferred): resolve by `getTemplateById(id)` scoped to userId+projectId (and name lookup with explicit non-paged query), not a paged list. No test covers the >20 case.

### Medium

- **M-1 (robustness) — `render-worker/src/services/fontLoader.ts:177`:** `registeredKeys.add(key)` runs **before** the try; a transient download failure permanently poisons that (family,weight,style) tuple for the process lifetime — no retry even after the catalog recovers. Inconsistent with the catalog-retry reset at `:120-122`. No test covers the poisoned-key path.
- **M-2 (dead-code landmine) — `unifiedTemplateStorageService.ts:766` (`updateTemplate`):** deletes then re-saves **without `id`/`kind`/`global`**; the "save as new version" comment implies same-ID, but the fresh save mints a new uuid + blob (old one deleted). Zero callers today (grep across `api-server/src`), so latent — but it silently violates GD-T1 invariants if ever wired to a route. Either pass `id` through or delete the method.
- **M-3 (parity divergence) — `fontLoader.ts:66` vs `fontService.ts:40`:** the worker maps only the literal `'bold'`; the browser also maps `700` / `'700'` to bold. A template authored with numeric weight renders **bold in browser, normal in worker**. (Whether the designer ever emits numeric `fontWeight` was not verified.)

### Low

- **L-1 — `templateService.ts:151`:** LOCAL_ONLY in-place saves mint a **new id each save** → gallery twins accumulate for unsynced saves. Documented behavior; acceptable while offline, but the id churn defeats GD-T1 for that path.
- **L-2 — `fabricTemplateRenderer.ts:250`:** worker QR raster is generated at `size` then stretched to `width/height` when they differ — slight blur at non-square QRs. Render at target size instead.
- **L-3 — fit parity asymmetry:** worker fit handles right-overflow only; browser also shrinks on left-edge overflow. Minor; worker has no left-edge concept (canvas-relative).
- **L-4 — family-match case sensitivity:** browser/worker catalog matching differ on case folding; a family stored with different casing resolves in one side only.
- **L-5 — `fontLoader.ts:148-151`:** temp font files are written once (`mkdtempSync`) and **never cleaned** — unbounded disk growth on long-lived workers. `path.join(tempDir, fontId + ext)` is unsanitized but safe today (catalog ids are server-generated UUIDs; globals-only for the unauthenticated worker). No magic-byte validation of downloaded files (upload validates extension only) — defense-in-depth only, freetype parses without code exec.
- **L-6 — compose style inconsistency:** dev/prd compose hardcode `INTERNAL_API_URL: http://api-server:${API_INTERNAL_PORT:-4000}`; demo allows `${INTERNAL_API_URL:-…}` override. Cosmetic; prefer uniform.
- **L-7 — GD-T2 dedupe by name-only** (documented deviation from the plan's (name, projectId)): cross-project same-name collisions possible in theory; projectId is absent from frontend metadata, so acceptable.

---

## 4. Test quality

Meaningful overall — the new tests assert real behavior, not tautologies:
- `fontLoader.test.ts`: variant mapping, catalog fallback, warn-and-continue, caching.
- `fabricTemplateRenderer.test.ts`: `computeFitScale` clamps; `drawQr` asserts the actual drawImage destination rect (120×60).
- `templateService.test.ts` (new, untracked): twin-dedup + unsynced marking.
- `unifiedTemplateStorageService.test.ts` (new, untracked): 6 api tests for id>name>new resolution.

**Gaps:** no test for (a) the >20-template resolution (H-1), (b) poisoned-key retry (M-1), (c) numeric fontWeight (M-3), (d) QR stretch rendering (L-2). The untracked test files are not yet committed — remember to include them.

---

## 5. Security review

The diff itself is **authorization-sound**: id-keyed save is owner-scoped (foreign/unknown id falls through to name-match, also owner-scoped, then fresh uuid — no cross-tenant overwrite); blob keys are server-generated ids (fallback storage sanitizes path components anyway, `fallbackStorageService.ts:507`); load enforces owner-or-`isPublic` before any storage read; `isPublic`/global overwrite is role-gated; no SSRF (worker fetches only env-fixed `INTERNAL_API_URL`; template-controlled `fontFamily` is only a catalog lookup key); compose/Dockerfile diffs add no secrets.

- **S-1 (HIGH, pre-existing — newly relied upon) — `api-server/.../fontController.ts:218`:** `request.user?.id || query.userId` on the optional-auth `GET /api/v1/fonts/:fontId/file` lets **any anonymous caller fetch any user's private font file** given (userId, fontId); the endpoint also echoes arbitrary Origin with `Allow-Credentials` (`:236-238`). `fontLoader.ts:11-15,137-142` explicitly documents and depends on this userId-as-credential model. Recommend (separately from this iteration): drop `query.userId` (worker should authenticate internally with a service token) or gate it behind a role check.
- **L-5 hardening** (temp-dir cleanup, fontId format validation, magic-byte sniff) — see §3.

---

## 6. Not verified / limitations

- Live E2E claims from HANDOFF (dev worker rebuilt with real Montserrat + `tmp/font-probe.png`; prd image build; demo compose validation) — **not reproduced** here (no browser, no rebuild performed); unit/gate level only.
- "eslint before/after counts proven" (CanvasControls 24→24, DesignCanvas 75→75): asserted pre-existing by the same `any`-count method on templateService (confirmed pre-existing); per-hunk attribution for the two canvas files was not re-derived.
- Whether the designer ever emits numeric `fontWeight` (M-3 real-world impact).
- `stg` environment: none exists in this repo (dev/prd/demo only) — consistent with the plan.
- Worker tsc (cassandra-driver types) was not re-run; per HANDOFF it is a single pre-existing error.

---

## 7. Recommendations (no code changed)

1. **Before commit:** fix H-1 (unpaged id/name resolution) — the only finding that can reintroduce the reported bug class; add the >20-template test.
2. Fix M-1 (move `registeredKeys.add` after successful registration) + M-3 (mirror browser weight mapping) — both small.
3. Remove or fix dead `updateTemplate` (M-2).
4. Schedule S-1 (font file endpoint authz) as a separate security task — do not block this iteration on it, but do not leave it unlogged.
5. Track L-1…L-7 as tech-debt notes; L-5 (temp dir) matters on long-lived workers.
6. Include the 6 untracked files (2 plans already in touch-scope, 4 test/source files) in the commit; `BATCH-EXPORT-IMPLEMENTATION.md` contract already updated.
