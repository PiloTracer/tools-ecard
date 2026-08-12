# Plan — Import UX + Templates (tasks 6–11) — 2026-08-12

**Status:** Approved 2026-08-12 — implemented Passes 0–6
**Origin:** `.work/prompts/20261011-new-import-features/prompt.md` (x-director), session interrupted 2026-08-12 after completing verifications 1–5; plan never written. This document is that plan, rebuilt from the export `tmp/qwen-code-export-2026-08-12T01-33-04-726Z.md` plus fresh codebase verification. Reviewed against `.work/feedback/20260811-uncommitted-review-import-ux.md` (2026-08-12): findings 1.1/1.2/1.5/3.4–3.9 incorporated.
**Standing constraints (owner):** no regressions · comprehensive tests per pass (incl. Python↔TS parity) · incremental passes, each independently shippable · both Demo and Production fully operational.

---

## 1. Verification results (tasks 1–5) — baseline, confirmed

| # | Task | Verdict |
|---|------|---------|
| 1 | How import works | ✅ Single entry `UploadBatchComponent` (drag-drop/browse/Ctrl-V; `.csv/.txt/.md/.vcf/.xls/.xlsx` ≤10 MB) → name modal → Normal: `POST /api/batches/upload` → **Bull v4** queue (consumer `workerService.ts` **inside api-server**, not render-worker) → Python parser → Postgres+Cassandra; Demo: client-side `demoSpreadsheetParser.ts` → localStorage/IndexedDB |
| 2 | Pasted batches | ✅ Tabular (`,`/`;`/tab auto-detect), KV blocks, vertical email-anchored, multi-section, stacked one-cell-per-line — parity-tested both parsers |
| 3 | Uploaded text | ✅ `.txt`/`.md` both modes, operator-sample fixtures |
| 4 | Excel | ⚠️ `.xlsx` both modes (pandas/openpyxl Normal; JSZip-XML Demo); `.xls` Normal-only; first worksheet only; **no transposed XLSX support** (blocks task 7); **`.vcf` live bug** (accepted, no parser branch → "No data extracted" Normal; rejected Demo) |
| 5 | Custom + vCard field names | ✅ 30 vCard fields case/separator-insensitive both sides + EN/ES aliases + fuzzy token matching. Caveats: three hand-synced alias tables (parity risk); **Normal silently drops unmapped columns** (`api-server/batch-parsing/parser.py:435` → `{}` into Cassandra `extra`; Demo keeps raw headers) |

**Test baseline (containers, use `sh` not `bash`):** python 35/35 · front-cards jest 215/215 (29 suites) · api jest 148 pass / 1 fail / 3 skip — the failure is pre-existing and unrelated: `api-server/tests/core/integrations/appLibraryStorageIntegration.test.ts` ("requires integration in strict production", env-var leak). Fix in Pass 0 so later gates are trustworthy.

## 2. Confirmed owner decisions (from interrupted session)

1. **Superuser mechanism:** tools-dashboard client-app roles — guide at `tools-dashboard/.work/docs/guides/client-app-roles/README.md` (Approved SPEC 2026-08-11). `app_roles` JWT claim for rendering; `POST /auth/internal/oauth/validate-token` authoritative for elevated actions. **Owner-confirmed 2026-08-12:** existing app roles unchanged; two NEW roles — `appglobal` (user-level, any app) and `appsuper` (user+this-app). **Either** role unlocks global-template management — plain membership check (`roles.includes('appsuper') || roles.includes('appglobal')`), no implication mapping, deny by default.
2. **Mapping scope:** per-batch **and** saved mappings (auto-suggest next time).
3. **`.vcf`:** owner wants real vCard import — implemented as its own pass (Pass 2), both parsers. Pass 0 only replaces the silent failure with an honest error until then.
4. **Demo globals (owner-confirmed 2026-08-12):** dual mechanism — (a) API-served globals authored in Production, read-only in Demo; (b) **bundled globals**: operator drops the exported design `.zip` (exactly as produced by the existing Export feature) + a same-named preview image into `front-cards/public/templates/globals/` — they appear in the gallery transparently, in both modes, even server-independent. See A4.

## 3. Architecture decisions (apply across passes)

**A1 — Roles plumbing (backend).** `authMiddleware.ts` already validates every token against userinfo. Extend: after validation, base64-decode the JWT payload and copy `app_roles` (string[]) onto `AuthenticatedUser.roles` (no signature verification needed here — the userinfo call already established token validity; this is the "render" path). Add `requireAppRole` preHandler that calls `validate-token` and re-checks roles **authoritatively** before any global-template mutation. New env: `OAUTH_VALIDATE_TOKEN_ENDPOINT` (default derive from `OAUTH_USER_INFO_ENDPOINT` origin). No new npm deps (payload decode is base64 only).

**A2 — Roles plumbing (frontend).** `normalizeOAuthUser.ts` currently whitelists fields — extend the auth flow so `roles: string[]` reaches `AuthContext`: front-cards `/api/auth/user` route decodes `app_roles` from the stored access-token JWT (UI hints only; server enforces). Add `useAppRoles()` / `canManageGlobalTemplates = roles.includes('appsuper') || roles.includes('appglobal')`. Unknown future roles ignored; existing app roles/permissions untouched.

**A3 — Global templates storage.** Revive the dormant `TemplateMetadata.isPublic` column (`schema.prisma:84`) as the global flag rather than adding a new column; rename semantics in code to "global". ⚠️ **Precondition (verified 2026-08-12):** `isPublic` is declared in the schema but **no migration contains `is_public`** (migrations hold only `20250118_template_designer` + `20251127_add_project_phone_config`) — schema-vs-DB drift is likely, so Pass 0 must run `prisma migrate status`/`migrate diff` and create the missing migration before any pass relies on the column. `TemplateShare` stays unwired (out of scope). Listing becomes `where: { userId } OR { isPublic: true }`; load allowed for globals; update/delete gated by role; regular users saving over a global get a fork (new per-user copy), never an overwrite.

**A4 — Global templates reach users through two channels (both merged, deduplicated, into one gallery):**

1. **API globals** (Normal always; Demo when the API is reachable): authored in Production by `appsuper`/`appglobal`, stored via `isPublic` (A3), served read-only through existing GET endpoints (Demo write guard blocks mutations only). Regular users fork via "Save as copy".
2. **Bundled globals** (both modes, zero server dependency — the Demo answer): convention directory `front-cards/public/templates/globals/`. The operator exports a design with the **existing Export feature** (produces the `.zip` package), drops `<name>.zip` + a same-named preview image (`<name>.png`) into that directory. A checked-in `manifest.json` (`[{ "name", "file", "preview", "description?" }]`) lists them; a helper script `front-cards/scripts/build-global-templates-manifest.mjs` regenerates the manifest by scanning the directory (run manually/in-container after dropping files; wiring it into `package.json` `prebuild` is optional and needs owner approval — `package.json` is a protected file). At runtime the gallery fetches the manifest (static asset, no auth, no demo-guard issues), loads each ZIP through the **existing JSZip import path** (same code as `handleImportJSON`), and shows the preview image as the card thumbnail. Entries are read-only, badged "Global"; opening forks a local copy on save. Missing preview → fallback placeholder; missing/corrupt ZIP → entry hidden with a console warning (never breaks the gallery).

**A5 — Template XLSX downloads are static generated assets, not runtime generation.** Neither api-server nor front-cards has an xlsx writer (front-cards has `jszip` only; adding `exceljs` ≈ heavy dep — rejected). Instead: `scripts/generate-import-templates.py` (run inside api-server container, uses existing `openpyxl`) generates both workbooks from the **canonical field list** and commits outputs to `front-cards/public/templates/import-template-horizontal.xlsx` + `import-template-vertical.xlsx`. Static assets serve both Demo and Production with zero auth/guard concerns. Regeneration is part of the alias-parity CI gate (A6).

**A6 — Canonical field list, single source.** Promote the 30-field list to `packages/shared-types/src/domain/vcard-fields.ts` (id, labels EN/ES, category; **snake_case ids are canonical**). `vcardFields.ts` (front) re-exports; Python `data_normalizer.py` keeps its own dict but a **parity test** asserts key-set equality against a generated JSON snapshot; the template-generator script consumes the same snapshot. **Casing note (verified 2026-08-12):** the three representations differ — Python `FIELD_MAPPING` keys and front `vcardFields.ts` ids are snake_case (`full_name`), but Demo `HEADER_ALIASES` targets are camelCase (`fullName`, `keyof DemoContactFields`). The parity test must normalize case (snake↔camel conversion) or carry an explicit id-mapping table, or it will false-fail on the Demo side. This kills the three-hand-maintained-lists risk.

**A7 — Mapping engine placement.** Implement on the **mounted Fastify router** `api-server/src/features/batch-import/routes.fastify.ts` (registered at `app.ts:144` under `/api/batch-import`, stubs: `/:id/preview`, `/:id/mappings/suggest`, `/:id/validate`, `/:id/status`, `/:id/import`, `/:id/cancel`) — extend/rename these stubs rather than creating a parallel surface. The **dead Express duplicate** (`batch-import/routes.ts` + `controllers/`, self-documented as unused, incompatible with the Fastify authMiddleware) must not receive new code; its deletion is recommended to kill drift — **requires owner approval** (no file deletion without it). Normal mode: upload → preview endpoint parses headers + sample rows, returns auto-mapping (alias+fuzzy) with unmapped columns listed → user adjusts → mapping JSON passed to the Python parser as an explicit override file (parser change: `--mapping` arg consulted before alias/fuzzy passes; explicit mapping never loses a column — unmapped-by-user choice is stored into `extra`, no more silent drops). Demo mode: same UX client-side in `demoSpreadsheetParser` (mapping param consulted first). Saved presets: Prisma model `FieldMappingPreset` (userId, name, signature = sorted header hash, mapping JSON); Demo: localStorage. On upload, signature match auto-suggests the saved preset.

## 4. Implementation passes

### Pass 0 — Baseline hardening (preconditions)
- Fix `appLibraryStorageIntegration.test.ts` env-leak (isolate env per test).
- **DB drift check (A3 precondition):** run `prisma migrate status` / `migrate diff` in the api-server container; create the missing migration for `TemplateMetadata.is_public` (declared `schema.prisma:84`, absent from `prisma/migrations/`) so Pass 5's audit query can't hit a missing column.
- `.vcf`: stop the silent failure now — reject with a clear "vCard import coming soon" error at **both** accept points: backend `api-server/src/features/batch-upload/types.ts:105` (`ALLOWED_FILE_TYPES`) and frontend `UploadBatchComponent.tsx` (`ALLOWED_EXTENSIONS`); real parsing lands in Pass 2 and removes this rejection.
- Normal-mode silent drop: parser records unmapped columns into `extra` (raw) + parse report lists them; surface "N columns unmapped" in batch preview API.
- Parity guard test: python FIELD_MAPPING keys ≡ shared-types snapshot ≡ demo HEADER_ALIASES targets (with snake↔camel normalization per A6).
- **Gate:** python 35+, api jest all green (incl. the fixed test), front jest green, tsc/eslint no new issues. Baseline re-verified live 2026-08-12 (review §6): python 35/35 · api 148/1fail/3skip · front 29 suites/215 — these are the pinned gate numbers.
- **Files:** `api-server/tests/core/integrations/appLibraryStorageIntegration.test.ts`, `api-server/batch-parsing/{file_parser,parser,data_normalizer}.py`, `api-server/src/features/batch-upload/{types.ts,routes.fastify.ts}` (accept list + errors), `front-cards` `UploadBatchComponent.tsx` accept list + error strings, `api-server/prisma/` (new `is_public` migration if diff confirms drift), `packages/shared-types/src/domain/vcard-fields.ts` + parity tests.

### Pass 1 — Tasks 6+7: downloadable template XLSX (horizontal + transposed) + transposed parsing
- `scripts/generate-import-templates.py` (openpyxl, in-container): horizontal workbook (row 1 = 30 vCard headers, row 2 = one example row, comments noting EN/ES aliases accepted) and vertical workbook (col A = headers, data in cols B+).
- Commit outputs to `front-cards/public/templates/`; add "Download template (rows)" / "Download template (columns)" links in the upload modal (`UploadBatchComponent`) — both modes, no API needed.
- **Transposed XLSX parsing (both parsers):** add first-column header detection (mirror `find_header_row` scoring down column A); when vertical score > horizontal score, transpose matrix before the existing pipeline. Python: pandas/openpyxl read → orient check. Demo: `parseXlsxBuffer` matrix → same orient check. Reuse existing vertical-contact logic where possible.
- **Tests:** generator golden output test; transposed-parse fixtures (synthetic xlsx with self-closing cells — the 2026-07-16 regression shape) both parsers; parity golden updated; UI link smoke test.
- **Files:** creates `front-cards/public/templates/` (new directory — does not exist yet) with the two committed workbooks; `scripts/generate-import-templates.py`; both parsers; `UploadBatchComponent.tsx`.
- **Gate:** full suites green both modes.

### Pass 2 — `.vcf` vCard import (both modes) — owner-requested (D2)
- **Normal:** `file_parser.py` gains a `.vcf` branch — split `BEGIN:VCARD`/`END:VCARD` blocks (handle vCard 2.1/3.0/4.0, line unfolding, `QUOTED-PRINTABLE`/charset decode for 2.1, escaped `\,` `\;` `\n`), map properties onto the canonical 30 fields: `N`→firstName/lastName (+fullName fallback), `FN`→fullName, `ORG`→business_name (+department from 2nd org unit), `TITLE`→jobTitle, `TEL;TYPE=WORK/CELL/...`→phones, `TEL;TYPE=...;X-EXTENSION`/ext heuristics→extension, `EMAIL`→email, `ADR`→address fields, `URL`→website/social, `NOTE`→notes. Unknown properties → `extra` (no silent drops, consistent with Pass 0). Then the existing normalize pipeline runs unchanged.
- **Demo:** `demoSpreadsheetParser.ts` gains a parallel `parseVcf` (same mapping table — parity by shared fixture), wired into the accept path where `.vcf` is currently rejected.
- Multi-contact `.vcf` → one batch record per card. No new deps (hand-rolled both sides, mirrors the existing vertical/JSON branches; a npm `vcf` lib was considered and rejected — Demo parser is deliberately dependency-free beyond jszip).
- **Tests:** fixture cards per version (2.1 quoted-printable accented names, 3.0, 4.0), multi-card file, phone-type distribution, org/title mapping, parity golden fixture (py↔ts), malformed-card resilience; upload-accept regression (Pass 0 rejection removed).
- **Gate:** full suites green; `.vcf` end-to-end in both modes.

### Pass 3 — Tasks 8+9: field-mapping feature (upload + paste, both modes)
- Backend: implement the mapping service on the **mounted Fastify router** (`/api/batch-import`, per A7) — extend the stubs: `POST /api/batch-import/:id/preview` (parse headers + ≤5 sample rows, return per-column: auto-mapped field | null, confidence, sample values), real `GET /:id/mappings/suggest`, and the upload route `POST /api/batches/upload` accepts an optional `mapping` override. `FieldMappingPreset` Prisma model + migration + CRUD (`GET/POST/DELETE /api/batch-import/mappings/presets`). Dead Express copy untouched pending owner-approved deletion (A7).
- Python parser: `--mapping` JSON arg; explicit mapping applied before alias/canonical/fuzzy passes; user-confirmed "ignore" columns go to `extra` verbatim.
- Frontend: mapping modal step in upload flow (upload & paste): shown automatically when unmapped columns exist, optionally via "Adjust mapping" button; column → vCard-field dropdowns (from shared-types list) with sample values; "Save this mapping" checkbox. Demo: identical modal fed by `demoSpreadsheetParser` header detection; presets in localStorage.
- **Tests:** parser mapping-override unit tests (py + ts), preview endpoint tests, preset CRUD tests, modal component tests, e2e-ish flow test (upload→unmapped→map→records correct), parity fixture.
- **Gate:** full suites green; no regression in alias/fuzzy auto-mapping when no explicit mapping given.

### Pass 4 — Task 10: user templates (save-as-template vs save-as-design)
- Prisma: add `kind String @default("design")` (`template`|`design`) to `TemplateMetadata` + migration; list endpoints accept `?kind=`.
- Editor semantics: opening a **template** forks intent — Save creates a new **design** (never overwrites the template); explicit "Save as new template" action keeps template lineage. Opening a design saves in place (current behavior).
- Demo: `demoTemplateRepository` gets the same `kind` field (localStorage metadata schema bump with backward-compat read).
- UI: gallery tabs/filters (Templates | My designs); save modal copy updated.
- **Tests:** repository/service tests both modes, migration test, UI modal tests.

### Pass 5 — Task 11 + roles: global templates gated by `appsuper`/`appglobal` (either role, per owner)
- Backend roles (A1): `AuthenticatedUser.roles`, `requireAppRole` preHandler w/ `validate-token`, env additions to **all three** per-environment example files (`.env.dev.example`, `.env.demo.example`, `.env.prd.example` — there is no root `.env.example`); real `.env*` edits flagged for owner.
- Global templates (A3): `isPublic` semantics wired — list merges globals for all users; `POST /api/v1/template-textile?global=true` + update/delete on globals behind `requireAppRole`; regular-user save-over-global → fork copy; globals immutable to non-supers at the service layer (defense in depth, not just route gate).
- Frontend (A2): roles in auth context; "Global" badge + read-only open for regular users ("Save as copy"); superusers see "New global template" / edit controls; hidden entirely when roles absent (deny by default).
- Demo (A4): globals fetched read-only from the API **and** bundled globals loaded from `front-cards/public/templates/globals/` (manifest + ZIP + same-named preview PNG, loaded via the existing JSZip import path), merged into the gallery, fork-to-local on save. Bundled channel also serves Normal mode, so operator-curated templates ship without touching the DB.
- Bundled channel plumbing (A4.2): creates `front-cards/public/templates/globals/` (new directory) + `front-cards/scripts/build-global-templates-manifest.mjs` + checked-in `manifest.json` + gallery merge/badging + corrupt-entry resilience.
- **Tests:** role-claim decode unit tests, `validate-token` preHandler tests (mocked, incl. revoked → 403; either-role acceptance), global list/merge/fork/immutability tests, Demo read-only path tests, bundled-manifest loader tests (missing preview, corrupt ZIP, empty manifest), UI gating tests (roles present/absent/unknown roles).
- **Gate:** full suites green; manual smoke script `curl validate-token` documented in ops runbook.

### Pass 6 — E2E + docs + hardening
- Playwright smoke extended: download template → fill → upload → mapping modal → batch created → `.vcf` import → open global template (API + bundled) → save-as-copy.
- Ops runbook + README updates (template downloads, mapping presets, roles, **how to drop bundled globals into `public/templates/globals/`**); HANDOFF/NEXT/registry bookkeeping.
- Final cross-mode verification matrix (Demo/Prd × paste/txt/vcf/xlsx/transposed/mapped/global).

## 5. Pass dependencies

```
Pass 0 (baseline) ──► Pass 1 (templates xlsx) ──► Pass 2 (.vcf import) ──► Pass 3 (mapping) ──► Pass 4 (user templates) ──► Pass 5 (roles+global, API+bundled) ──► Pass 6 (e2e/docs)
```
Pass 2 is independent of Pass 1 and could move earlier; order above keeps all file-format work contiguous before UI-heavy passes. Passes 1 and 4 are technically independent; globals (Pass 5) build on `kind` (Pass 4).

## 6. Risk register (top items)

| Risk | Mitigation |
|------|-----------|
| `app_roles` claim absent from tokens until tools-dashboard back-auth is deployed in each env | Deny-by-default: feature hidden when claim missing; verify against dev dashboard `http://localhost:8082` in Pass 5 before prd |
| Claim staleness ≤1h after revoke | All mutations use `validate-token` (authoritative); claim used for rendering only |
| Transposed detection false positives on narrow sheets | Orientation chosen only on clear score margin; ambiguous → horizontal (status quo) |
| vCard dialect drift (2.1 quoted-printable / charsets, 3.0, 4.0) | Per-version fixtures + py↔ts parity golden; unknown properties preserved in `extra` |
| Mapping override corrupting batches | Parser validates mapping targets against canonical list; unknown targets rejected 400 |
| Demo/Normal parser drift (3 alias tables today) | A6 parity tests + golden fixtures gate every pass |
| Bundled-globals manifest stale after operator drops files | Regenerator script scans the directory; runbook documents the step; loader tolerates missing/corrupt entries without breaking the gallery |
| `isPublic` revival colliding with old rows | Column defaulted false, never read before — audit query in Pass 5 confirms no legacy `true` rows before enabling (Pass 0 creates the missing migration first — see A3 precondition) |
| `is_public` schema-vs-DB drift (no migration contains it today) | Pass 0 `prisma migrate status`/`diff` + new migration before any pass reads the column |

**Registry hygiene (on plan approval):** close `.work/plans/RISK_REGISTRY.md` R2 ("Batch import HTTP layer still placeholder" — closed by Pass 3) and register the new risks above there.

## 7. Verification commands (every pass)

```bash
docker compose -f docker-compose.dev.yml exec api-server sh -c "cd /app && npm test"
docker compose -f docker-compose.dev.yml exec api-server sh -c "cd /app/batch-parsing && python3 -m unittest discover -v"
docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && npx jest"
docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && npx tsc --noEmit"   # NODE_OPTIONS=--max-old-space-size=460 if OOM
docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && npx eslint <touched>"
```

## 8. Decision points — RESOLVED 2026-08-12 (owner)

- **D1 — Demo globals:** ✅ dual channel per A4 — API globals (Production-authored, read-only in Demo) **plus bundled globals** dropped by the operator into `front-cards/public/templates/globals/` as the exported `.zip` + same-named preview image; manifest-driven, transparent in the gallery, both modes.
- **D2 — `.vcf`:** ✅ real vCard import wanted → Pass 2 (both parsers); Pass 0 only makes the current failure honest until then.
- **D3 — role semantics:** ✅ no implication mapping; existing app roles unchanged; `appsuper` **or** `appglobal` grants global-template management, enforced server-side via `validate-token` and reflected in UI via the JWT claim.
- **D4 — OAUTH_SCOPES:** ✅ no change (`profile email` suffices; roles ride the `app_roles` JWT claim). Pre-implementation check in Pass 5: confirm tools-dashboard issues `app_roles` for the ecards `client_id` in dev and prd.

**No open questions remain. Plan ready for approval → implementation starts at Pass 0.**

---

## 9. Implementation record (2026-08-12)

Gate counts = python unittest / api-server jest / front-cards jest (all in dev containers).

| Pass | Delivered | Gate after pass |
|------|-----------|-----------------|
| P0 | Env-leak test fixed; `is_public` migration baselined+added; unmapped columns preserved into record `extra` + `unmapped_columns`; canonical 30-field list + snapshot JSONs + 3-way parity tests | py 40 / api 150 / front 218 |
| P1 | Downloadable import templates (horizontal+vertical XLSX) + generator script + upload-UI links; transposed-XLSX parsing both parsers | suites green |
| P2 | `.vcf` vCard import both parsers (2.1 QP/charset, 3.0, 4.0; multi-card; unknown props → `extra`) | suites green |
| P3 | Field mapping: `POST /api/batch-import/preview`, `--mapping` parser override, upload threading (`Batch.fieldMapping`), `FieldMappingPreset` + CRUD, `FieldMappingModal` (upload+paste, EN/ES, presets), Demo parity | suites green |
| P4 | `TemplateMetadata.kind` + migration; template-fork-on-Save; "Save as new template"; gallery kind pills + badges | suites green |
| P5 | Roles (`AuthenticatedUser.roles`, `requireAppRole` → validate-token, fail-closed); global templates via `isPublic`; bundled channel `public/templates/globals/` + manifest script; frontend roles + gating UI | py 62 / api 207 / front 305 |
| P6 | Playwright smoke extended (6 specs); ops runbook + README updates; RISK_REGISTRY (R2 closed, R11–R15 opened); this record | **Final: py 62 (61+1 in-container skip) · api 207 pass/0 fail/3 skip (24 suites) · front 305 pass (44 suites) · front tsc clean · prisma 5 migrations up to date · playwright 6/6 compile (`--list`)** |

### Deviations from plan

- **Prisma baseline resolve:** dev DB had drift predating the plan; `is_public` migration was applied via `migrate resolve` baselining before adding the new migration (no data touched).
- **Fixture duplication:** `vcard-fields.snapshot.json` is duplicated per tree (`api-server/batch-parsing/fixtures/`, `front-cards/features/demo/fixtures/`) because containers mount only their own tree — parity tests keep the copies in sync.
- **Preview route name:** implemented as `POST /api/batch-import/preview` (multipart body) instead of the stub shape `POST /:id/preview` — analysis runs on the uploaded file before a batch exists, so there is no `:id` yet.
- **`loadTemplate` access-check fix:** a service-layer access check initially blocked opening global templates; fixed so load is open for `isPublic` while mutations stay gated.
- **jest diagnostics exclusion:** 2 pre-existing tsc errors in `unifiedTemplateStorageService.ts` excluded from ts-jest diagnostics via a documented `jest.config.js` exception (not fixed — out of scope).
- **Express stub deletion:** the dead `batch-import/routes.ts` + `controllers/` Express duplicate is still present — deletion requires owner approval and remains pending (A7).
- **Pass 6 playwright:** full browser run not possible in the Alpine (musl) dev containers — Playwright's glibc chromium binaries don't exec there; specs verified via `--list` (6/6 compile) and the full suite runs in the CI ubuntu job (`front-cards-e2e`). Demo-mode upload and API-global flows need a live tools-dashboard login — covered by lighter checks + jest, gap documented.
