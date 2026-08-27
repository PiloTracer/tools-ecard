# Plan — Field-binding & line-compaction reliability fix

**Date:** 2026-08-27 · **Status:** Approved 2026-08-27 (D1: P1.1 as written; D2: full server parity; D3: property-panel fixes included) · **Origin:** @x-director free-text intake (operator report)

**Owner clarification on `linePriority` (D1 follow-up):** the priority numbers never did what their UI copy claimed — only `=== 1` was read, as a primary-element flag, never as ordering (ordering comes from the lineGroup number). Under P1.1 it has no role at all: **`linePriority` is removed entirely** — deleted from the compaction logic, removed from the property panel, deprecated (ignored-but-tolerated) in the element schema so existing template JSON still loads. The operator's guessed use (fallback substitution order: "which field replaces a blank one") is a **different feature** (field fallback chains) — not in this scope; candidate for a future SPEC.

## Operator requirement (verbatim anchors)

1. **Keep** the group-line functionality: if the text data of a line is missing in a record, the line is hidden and the next group moves into its exact position.
2. **Guarantee:** if a batch record has data for a field, and the card/QR design has a corresponding text field, that data **must** be visible in the final render.
3. The field-setting process must be user-friendly, clear, and reliable.

## Root causes (all verified by direct code read)

### RC1 — Compaction deletes lines that have data
`front-cards/features/template-textile/services/lineCompactionService.ts:106-111` — a line's existence is judged **only** by the element with `linePriority === 1`. If no element on the line has `linePriority === 1`, the line is `continue`d past and lands in `linesToRemove` (`:196-224`): **every element of the line is deleted from the export, data or not.** Also: if the priority-1 element is empty but a *sibling* on the same line holds data, the sibling is deleted too.

This is the direct cause of the operator's symptom: the mobile number only rendered after the user manually grouped lines and set metadata `text-1` + priority — i.e. after satisfying an undocumented survival condition.

### RC2 — The UI suggests lineGroup formats the parser rejects
`LineMetadataProperties.tsx:57-67` suggests `contact-line-1`, `phone-line`, `email-line`, etc. The parser regex `/^(\w+)-(\d+)$/` (`lineCompactionService.ts:43`) accepts **only** `type-number` with a dash-free prefix (`text-1`, `icon-2`). Every built-in suggestion fails to parse → element silently skipped (`:44-47`) → section partially grouped → inconsistent placement. The working `text-1` format is documented only in `.work/plans/proposals/from-claude/TEMPLATE_LINE_COMPACTION.md`, not in the UI.

### RC3 — Binding key is invisible and unvalidated
The canvas shows placeholder *text*; the actual binding key is a separate `fieldId` property, editable as free text under a label "Field Name" (`TextProperties.tsx:30-42`), with no dropdown, no validation against the 30 canonical ids, and silent sanitizer rewrites (`TextProperties.tsx:22-25`). At export, an unmapped/typo'd `fieldId` resolves to `undefined` and the text is **cleared to `''`** (`batchExportService.ts:259-267, 305`) with no warning — which then triggers RC1 line removal. No alias/case resolution exists at render time (aliases are applied only at ingest).

### RC4 — Browser vs server render divergence
- Server `resolveText` **falls back to the design-time placeholder** when the record value is missing (`render-worker/src/services/fabricTemplateRenderer.ts:130-141`), while the browser clears to `''` (`batchExportService.ts:305`). Same template + record → different cards.
- render-worker has **no line compaction at all** — zero `sectionGroup`/`lineGroup` handling; `TemplateElementJson` (`fabricTemplateRenderer.ts:10-39`) doesn't even carry the metadata fields.
- Cassandra-miss PG fallback carries only 5 of 28 fields (`render-worker/src/services/renderer.ts:84-92`); the rest silently render as placeholders.

### RC5 — Dead/misleading metadata
- `requiredFields` ("Line will be hidden if any required field is empty", `LineMetadataProperties.tsx:207`) is written to template JSON but **read by no code path**.
- "Line Priority" UI copy says "Order for automatic line reordering" (`LineMetadataProperties.tsx:140-142`); the code uses only `=== 1` as a primary flag, never for ordering.

### RC6 — Silent drops everywhere
No per-export report of: unbound elements (no `fieldId`), unmapped `fieldId`s, lines removed by compaction, record fields that never reached any element. Failures surface only as `console.warn`.

## Fix design

### P1 — Correctness (required to meet the operator requirement)

**P1.1 — New line-emptiness semantics** (`lineCompactionService.ts`):
A line **has content** when ANY of:
- a **data-bound** element on it (text with `fieldId`, or any element with `requiredFields`) has a non-empty post-fill value;
- it contains **no data-bound elements at all** (pure static line — e.g. a header) → always kept.

Static elements (icons, static labels) never count toward content — preserving requirement 1 (icon-bearing lines still collapse when their data is missing).
`requiredFields` becomes real: if set on any element of the line, line visibility is decided by those record fields directly (record passed into compaction) — explicit override.
`linePriority` is **deprecated** (kept in schema for back-compat, ignored by logic, removed from the UI's emphasis). This is a deliberate behavior change vs. the old priority-1 rule — see D1.

**P1.2 — Never delete a line whose bound data exists** follows directly from P1.1: post-fill non-empty text ⇒ line survives. Requirement 2 enforced at the compaction layer.

**P1.3 — Robust render-time fieldId resolution** (both paths): trim + lowercase, then exact map, then `_N` suffix strip (existing), then **alias lookup** via `packages/shared-types/src/domain/field-aliases.json` (single source, already built). Unresolvable `fieldId` ⇒ keep current blank behavior but record it in the export report (P1.5) instead of silence.

**P1.4 — Server parity** (render-worker):
- Align empty-value behavior with the browser: bound field with missing value ⇒ render `''`, not the placeholder.
- Port line compaction (same P1.1 semantics) into the worker render path, sharing the field map/alias source. Extent decided by D2.

**P1.5 — Export report**: per batch export, collect and surface (browser UI summary + worker logs): elements without `fieldId`, unresolvable `fieldId`s, bound fields empty in record, lines removed by compaction, record fields with data that matched no element. Turns every current silent drop into an explicit, reviewable signal.

### P2 — UX hardening (user-friendly, clear)

**P2.1 — Line metadata UI** (`LineMetadataProperties.tsx`):
- Replace free-text lineGroup with valid suggestions (`text-1`, `icon-1`, …) or auto-assignment; validate input against `/^(\w+)-(\d+)$/` with inline error.
- Fix/remove the misleading "Line Priority" copy; hide or clearly deprecate the field per P1.1.
- `requiredFields` selector stays — now functional (P1.1).

**P2.2 — Field binding UI** (`TextProperties.tsx`): canonical-field dropdown (from `vcardFields`) with free-text escape hatch; inline warning when the entered `fieldId` won't resolve. Label clarified ("Data field", not "Field Name").

**P2.3 — Docs**: update `front-cards/features/template-textile/BATCH-EXPORT-IMPLEMENTATION.md` with the binding contract (fieldId is the key; canvas text is placeholder; compaction semantics; valid lineGroup format).

## Open decisions (need owner call)

- **D1 — Emptiness semantics change.** Recommended: P1.1 as written (any-bound-content + static-line exemption + requiredFields override; `linePriority` deprecated). Alternative: keep priority-1 primary rule but rescue data-bearing siblings (smaller change, keeps the fragile primary concept).
- **D2 — Server parity scope.** Recommended: full (P1.4 both parts) — requirement 2 says "finally generated card/QR", which includes worker renders. Alternative: browser-only now, worker follow-up.
- **D3 — UX scope.** Recommended: P2.1 + P2.2 now (the misleading suggestions are an active bug, RC2). Alternative: correctness only, UX later.

## Verification

- Unit: new emptiness semantics (data-bearing sibling survives; static-only line kept; icon+empty-text line collapses; requiredFields override; invalid lineGroup → reported, not silent).
- Regression reproducing the operator scenario: ungrouped/priority-less mobile-phone line with record data ⇒ renders; empty line ⇒ collapses and next group moves to its exact original coordinates.
- Parity: same template + record through browser export and worker render ⇒ same visible fields.
- Existing suites green: front jest, api-server jest, render-worker jest (all inside compose per `.cursorrules` §Docker).
- Export report asserted in tests (no silent drops).

## Residual risks / out of scope

- `renderer.ts:84-92` PG fallback (5/28 fields) — flagged, not changed by this plan.
- Position-map type collision (two same-type elements on one line overwrite each other, `lineCompactionService.ts:61-67`) — rare; fix only if D-scope confirms.
