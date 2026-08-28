# Font fidelity + fit fix plan — 2026-08-27

**Owner approval:** 2026-08-27 — "implement all fixes!!! do a professional job" (scope 1+2+3 from the diagnosis report; includes protected `render-worker/Dockerfile.{dev,prd}` font packages and compose env additions for render-worker).
**Diagnosis record:** `.work/context/HANDOFF.md` § "Cross-framework action (@x-director) — 2026-08-27 font/size not respected in generated cards (diagnosis)".

## Symptom

Some fields in generated cards render with the wrong font family and/or a font size reduced toward the default, with no legitimate fit-to-width reason. Correlated (maybe coincidentally) with line-grouped fields (`text-1`/`text-2`/`text-3`).

## Root causes (verified with file:line evidence)

- **RC-A (browser, primary):** `fontService.loadFont` injects `@font-face` with `font-display: swap` and marks the font loaded without awaiting any `FontFace` (`front-cards/features/template-textile/services/fontService.ts:96-135`). The only wait requests `16px "<family>"` without weight/style and swallows failures (`fontService.ts:290-303`). Fabric then creates text with a fallback family, and `fitTextToSafeArea` measures with fallback (wider) metrics → false overflow → uniform downscale to 0.5 (`exportService.ts:352-451`). One cause produces BOTH wrong font and unjustified shrink.
- **RC-B (browser, amplifier — explains the lineGroup correlation):** `fitTextToSafeArea` shrinks on ANY edge violation including `bounds.top < 30` (`exportService.ts:381-386`). Compaction moves surviving lines into earlier lines' original positions; a moved line landing in the 30px top margin gets shrunk even though it sits exactly where the design put line 1.
- **RC-C (render-worker):** zero fonts + no `registerFont` (known tofu issue; Dockerfile fix previously pending). Worker has NO fit-to-width code at all — server output cannot shrink, but fonts are silently substituted by Pango.

## Fix design (owner-approved scope 1+2+3)

### FC-T1 — Browser: make font preload actually await the needed face

- `fontService.loadFont` (non-demo): load via `new FontFace(family, url, { weight, style })` → `await face.load()` → `document.fonts.add(face)`; mark loaded only after the await resolves. Feature-detect `FontFace` (jsdom tests); fall back to the style-tag path only when the API is unavailable. Remove `font-display: swap` (it mandates fallback-first rendering). Keep the font-synthesis CSS.
- `demoFontRepository.loadFont`: same treatment for the data-URL path (await `FontFace.load()` before resolving).
- `preloadFontsForElements`: replace the sloppy `16px "<family>"` wait with per-variant awaits (`<style> <weight> 16px "<family>"`) for exactly the variants requested by the elements; keep `document.fonts.ready` as the final barrier. Failures still warn-and-continue (a missing font must not crash export), but a *cataloged* font is now guaranteed loaded before Fabric object creation and measurement.
- Tests: update/extend `fontService.test.ts` (mock FontFace; assert awaited load, per-variant wait strings, no swap).

### FC-T2 — Browser: fit-to-width shrinks only for genuine width overflow

- `fitTextToSafeArea` (`exportService.ts`): shrink only when the text's width overflows horizontally (`exceedsRight`, or `exceedsLeft` width-basis as today). Top/bottom violations are logged as warnings, not shrunk — vertical placement is a design decision, and post-compaction positions are by-design. Clamp stays [0.5, 1.0]; still never scales up.
- Owner contract: "font and size respected always, except when data must fit a given width" — this makes the code match the contract.
- Tests: update `exportService.test.ts` safe-area cases (top-edge violation no longer scales; right overflow still scales; clamp respected).

### FC-T3 — render-worker: register real fonts before rendering

- New `render-worker/src/services/fontLoader.ts`:
  - Collect needed `(fontFamily, fontWeight, fontStyle)` tuples from the template's text elements.
  - Resolve via the api-server catalog, mirroring the browser: `GET {INTERNAL_API_URL}/api/v1/fonts?scope=all` → match family + variant (`regular|bold|italic|bold-italic`, same mapping as `variantFromTextStyle`); fall back to any variant of the same family (browser `resolveFont` behavior).
  - Download each matched file `GET {INTERNAL_API_URL}/api/v1/fonts/{fontId}/file[?userId=…]` to `os.tmpdir()` and `registerFont(path, { family, weight, style })` (node-canvas 2.11.2; registerFont takes a file path).
  - Best-effort with clear warnings: if the catalog/file is unreachable or a family is missing, warn and render with fallback (never crash a render job).
  - `render-worker/src/core/config/index.ts`: add `INTERNAL_API_URL` (default `http://api-server:4000`).
  - Compose: add `INTERNAL_API_URL` to the render-worker service env in `docker-compose.dev.yml` (`http://api-server:${API_INTERNAL_PORT:-4000}`) and `docker-compose.prd.yml` (matching prd service name/port).
  - `renderer.ts`/`fabricTemplateRenderer.ts`: call `ensureFontsRegistered(elements)` once per render before drawing.
- Auth check during implementation: verify whether the fonts list/file routes require auth; GLOBAL system fonts are expected to be readable without a token (the file route already has optional auth). If user-uploaded fonts need auth, worker passes the batch owner's userId where available; document whatever contract is found.
- Tests: `render-worker/tests/fontLoader.test.ts` (mock fetch; tuple collection, variant mapping, registerFont calls, warn-and-continue paths).

### FC-T4 — render-worker: fit-to-width parity

- Port the FIXED browser semantics: after fonts are registered, measure each text element with `ctx.measureText` at its design `fontSize`; if width overflows the available horizontal space (canvas width − element x − safe padding), redraw at `fontSize × clamp(needed/actual, 0.5, 1)`. No vertical shrink, matching FC-T2.
- Tests: register a real font in tests (DejaVu from the container image path, skip-guarded if absent) and assert overflow shrinks / non-overflow keeps design size.

### FC-T5 — Dockerfiles: ship baseline fonts (protected, owner-approved)

- `render-worker/Dockerfile.dev` (alpine): add `fontconfig ttf-dejavu ttf-liberation` to the apk line.
- `render-worker/Dockerfile.prd` runner stage (bookworm): add `fontconfig fonts-dejavu fonts-liberation` to the apt line.
- Effect: fallback rendering is legible (no more tofu) even before/without catalog resolution; registered design fonts (FC-T3) still take precedence.

### FC-T6 — Gates + docs + carriers

- Gates (dev compose, per `.cursorrules` §Docker): front jest + `tsc --noEmit` + eslint on touched files; worker jest + `tsc --noEmit`; touch-scope-verify; blast-radius-check.
- Docs: `BATCH-EXPORT-IMPLEMENTATION.md` — font-loading guarantee + fit-to-width contract (width-only shrink, 0.5 floor) on both render paths.
- MOD-06 risk summary; update NEXT.md + HANDOFF.md.

## Out of scope (explicit)

- QR vCard double-generation + worker static-QR findings (logged in HANDOFF diagnosis — separate follow-up).
- Worker position-map same-type collision (`lineCompaction.ts:204`) — pre-existing, unchanged.
- SeaweedFS direct font fetch in worker (catalog goes through api-server instead — reuses auth/catalog logic).
- Multi-color text default-fontSize guard (`multiColorText.ts`) — only fires when template JSON lacks props; flagged, not changed.

## Acceptance criteria

1. A cataloged design font is fully loaded (exact weight/style) before any Fabric object creation or text measurement in browser export.
2. Browser export shrinks text only for genuine horizontal overflow; top/left/bottom placement never triggers shrink.
3. render-worker registers the template's design fonts (when resolvable via the catalog) and renders with them; missing fonts warn and fall back legibly (no tofu in dev/prd images).
4. render-worker applies the same width-only fit shrink with the same [0.5, 1.0] clamp.
5. All gates green; no file outside `.work/touch-scope` modified.
