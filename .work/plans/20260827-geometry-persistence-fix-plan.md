# Geometry persistence fix plan — 2026-08-27

**Owner approval:** 2026-08-27 — "CONTINUE YOUR ANALYSIS, AND MAKE SURE ALL TASKS ARE COMPLETED" + "THE POSITION AND DIMENSIONS OF OBJECTS MUST BE RESPECTED REGARDLESS OF THE WORKFLOW BEING USED" (after the diagnosis report).
**Diagnosis:** 2 explore probes (geometry round-trip; canvas-resize/store-sync extension), key claims re-verified by direct reads.

## Symptom

QR (or any object) placed/resized/centered, then save → close → reopen: object totally out of place. Batch export shows the SAME wrong position. "Save as new template" checked = works; unchecked = broken. Aggravating workflow: canvas resized, old objects removed, new objects placed.

## Root causes (evidence in HANDOFF § Cross-framework action records)

- **RC1 (primary — explains the checkbox correlation):** stale-twin / name-collision.
  - Server `saveTemplate` upserts by **name** (first match wins): `unifiedTemplateStorageService.ts:131-142`.
  - Storage blob keys are **name-derived** (S3 `:204`, fallback `:240-245`) → same-named rows share/overwrite one blob.
  - Front `listTemplates` merges **local-only** browser records with same name but different ids (`templateService.ts:459-480`); reopen/export can read the stale twin (load falls back to stale local cache on server 404, `templateService.ts:324-350`).
  - "Save as new" forces a deduped unique name (`templateSaveIntent.ts:34-40`) → no twin → works.
- **RC2 (co-contributor):** save-time geometry merge is **position-only** — `mergeLiveCanvasGeometryIntoTemplate` writes only x/y/rotation (`CanvasControls.tsx:69-105`); dimensions are store-trusted, and the store has holes (multi-select `object:modified` writes no dimensions `DesignCanvas.tsx:288-318`; QR `size` only synced on mouseup `:563`; guards can swallow modifications `:326-349`). Silent passthrough `if (!pos) return el` keeps stale values with no signal.
- **RC3 (worker parity):** `drawQr` uses `size` only, ignoring `width/height` (`fabricTemplateRenderer.ts:248-263`).
- **Verified NOT causes:** canvas-size round-trip (store-driven, consistent across designer/export/worker); origin mismatch; double-scaling; export zoom.

## Fix design (invariants)

1. **Identity, not name, keys a save.** Client sends `currentTemplate.id` on in-place saves; server prefers id-match (ownership/project verified), name-lookup only as legacy fallback; new blob keys derive from template **id** (loads read the stored `storageUrl`, so legacy name-keyed rows stay readable).
2. **No silent twins.** `listTemplates` local merge dedupes by (name, projectId) preferring server records; local fallback saves are marked `unsynced`.
3. **One canvas-authoritative geometry serializer.** The save merge folds live effective dimensions (`width*scaleX`, `height*scaleY`; `size` synced for QR; exact scale for images) per element id; store values never trusted at save; mismatched ids fail loudly (console.error + collected warnings), not silently.
4. **Close desync sources.** ActiveSelection `object:modified` writes folded dimensions per child; QR placeholder re-add doesn't depend on the map lookup.
5. **Worker parity.** `drawQr` honors `width ?? size` / `height ?? size`.

## Tasks

| ID | Description | Files |
|----|-------------|-------|
| GD-T1 | Identity-keyed save end-to-end: `SaveTemplateRequest.id` (front) → controller → `SaveTemplateInput.id`; server id-preferred lookup; id-derived S3/fallback blob keys; front adopts returned id | front templateService.ts(+new test), CanvasControls.tsx; api unifiedTemplateStorageService.ts, templateController.ts, tests/features/template-textile/unifiedTemplateStorageService.test.ts (new) |
| GD-T2 | Twin prevention: `listTemplates` dedupe by (name, projectId) preferring server; fallback local saves marked `unsynced` | front templateService.ts(+test) |
| GD-T3 | Canvas-authoritative geometry: extend save merge with folded dimensions per type + loud mismatch logging; assert template width/height present at save | front CanvasControls.tsx |
| GD-T4 | Desync fixes: ActiveSelection modified writes folded dimensions; QR placeholder re-add guard | front DesignCanvas.tsx |
| GD-T5 | Worker `drawQr` width/height parity + test | render-worker fabricTemplateRenderer.ts, tests |
| GD-T6 | Gates (api/front/worker jest, tsc, lint touched, touch-scope, blast-radius) + MOD-06 + docs + carriers | .work/*, BATCH-EXPORT-IMPLEMENTATION.md |

## Out of scope (explicit)

- Renaming/migrating existing name-keyed blobs (legacy rows stay readable via stored storageUrl).
- UI badge for `unsynced` records (service-level flag + log only; UI surfacing is a future UX task).
- Changing the save-guard (`processingModification`/`systemUpdating`) semantics — loop-prevention logic untouched.
- QR vCard double-generation + worker static-QR content (separate logged follow-ups).

## Acceptance criteria

1. In-place save updates the record the user actually edited — by id — never a same-named twin.
2. Two same-named records can never again alias one blob or shadow each other in the gallery.
3. Saved JSON geometry (position AND dimensions) is exactly what the canvas shows, for every object type, after any edit sequence incl. canvas resize + delete + re-add.
4. Reopen, browser export, and worker render all read the same geometry (worker QR honors width/height).
5. All gates green; touch-scope clean.
