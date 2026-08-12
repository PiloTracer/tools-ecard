# Change Inventory — Import UX + Templates (tasks 6–11) — 2026-08-12

Companion to `.work/plans/20260812-import-ux-templates-plan.md` (§9 implementation record). All work is **uncommitted** in the working tree. This document is the complete verification inventory: every changed file, grouped by capability, plus a walkthrough test matrix (automated + manual) for a later verification session.

## 1. Overview + verification gates

Seven passes (0–6) delivered: baseline hardening (env-leak fix, `is_public` migration, unmapped-column preservation, canonical 30-field list with 3-way parity), downloadable import-template XLSX (horizontal + vertical/transposed) with transposed parsing in both parsers, `.vcf` vCard import in both parsers, a field-mapping feature (preview endpoint, explicit `--mapping` parser override, per-batch mapping threading, saved presets with signature auto-suggest, mapping modal in the UI for upload AND paste), template kinds (`template` vs `design` with fork-on-save semantics), global templates gated by the `appsuper`/`appglobal` app roles (JWT claim for rendering, `validate-token` for mutations, fail-closed), and a bundled-global channel (operator drops export ZIP + preview PNG into `front-cards/public/templates/globals/`).

**Gates (run from repo root; containers must be up: `docker compose -f docker-compose.dev.yml up -d`; use `sh`, not `bash`):**

```bash
# Python parser — expected: Ran 64 tests, OK (skipped=1)
#   (the 1 skip is ImportTemplateTests.test_committed_templates_match_snapshot_when_repo_visible:
#    front-cards/ is not mounted in the api-server container; it runs on host/CI checkouts)
docker compose -f docker-compose.dev.yml exec api-server sh -c "cd /app/batch-parsing && python3 -m unittest discover -v"

# api-server jest — expected: Test Suites: 24 passed/24 total; Tests: 3 skipped, 207 passed, 210 total
docker compose -f docker-compose.dev.yml exec api-server sh -c "cd /app && npm test"

# front-cards jest — expected: Test Suites: 45 passed/45 total; Tests: 307 passed, 307 total
docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && npx jest"

# front-cards typecheck — expected: exit 0, no output
docker compose -f docker-compose.dev.yml run --rm -e NODE_OPTIONS=--max-old-space-size=460 front-cards sh -c "cd /app && npx tsc --noEmit"

# prisma — expected: "5 migrations found" + "Database schema is up to date!"
docker compose -f docker-compose.dev.yml exec api-server sh -c "cd /app && npx prisma migrate status"

# playwright (compile check only in Alpine dev containers; full run happens in CI ubuntu job front-cards-e2e)
docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && npx playwright test --list"   # 6/6 specs listed
```

Re-verified 2026-08-12 (two consecutive runs each, identical counts — no flake): py 64 OK+1 skip · api 207 pass/0 fail/3 skip (24 suites) · front 307 pass (45 suites) · tsc clean · prisma 5 migrations up to date. (The 62/44-suite/305 numbers in plan §9 predate two audit-driven test additions on 2026-08-12: `TransposedXlsxParsingTests.test_transposed_xlsx_with_explicit_mapping` + `test_inspect_reports_transposed_headers` in `api-server/batch-parsing/test_batch_parsing.py`, and new front suite `front-cards/features/demo/demoBatchRepository.test.ts`.)

## 2. Per-area change list (grouped by capability)

### 2.1 Canonical field list + cross-stack parity (single source of truth)

- `packages/shared-types/src/domain/vcard-fields.ts` (NEW) — canonical 30-field list `canonicalVCardFields` (`{id, labelEn, labelEs, category}`; snake_case ids; 15 core / 12 business / 3 personal); the one source for python `FIELD_MAPPING` keys, front template toolbox ids, and demo parser aliases.
- `packages/shared-types/src/domain/vcard-fields.snapshot.json` (NEW) — JSON serialization of the same 30 fields, consumed by parity tests and the template generator.
- `packages/shared-types/src/domain/index.ts` (M) — adds `export * from './vcard-fields';`.
- `api-server/batch-parsing/fixtures/vcard-fields.snapshot.json` (NEW) — byte-identical copy (containers mount only their own subtree; parity tests keep copies in sync).
- `front-cards/features/demo/fixtures/vcard-fields.snapshot.json` (NEW) — byte-identical copy for the front container.
- Tests: python `CanonicalFieldListParityTests` (`test_batch_parsing.py`), front `features/demo/vcardFieldsParity.test.ts` (ids + `HEADER_ALIASES` targets ≡ snapshot).

### 2.2 Import-template XLSX downloads + generator

- `api-server/batch-parsing/generate_import_templates.py` (NEW) — generates `import-template-horizontal.xlsx` (row 1 = 30 canonical headers + example row) and `import-template-vertical.xlsx` (headers down column A, example in column B) from the snapshot; `--outdir`/`--snapshot`/`--verify` modes; A1 comment notes EN/ES aliases accepted.
- `scripts/generate-import-templates.py` (NEW) — 26-line wrapper that `sys.path.insert`s `api-server/batch-parsing` and calls its `main()` (implementation lives in batch-parsing so unittests can import it). Run in-container, then `docker cp`/commit outputs.
- `front-cards/public/templates/import-template-horizontal.xlsx`, `import-template-vertical.xlsx` (NEW, committed static assets — serve both Demo and Normal with zero auth).
- `front-cards/features/batch-upload/components/UploadBatchComponent.tsx` (M) — renders `Download template (rows)` / `Download template (columns)` links (`/templates/import-template-{horizontal,vertical}.xlsx`, `download` attr) below the drop zone.
- Tests: python `ImportTemplateTests` (generate/verify round-trip, committed-assets check — the in-container skip, vertical parses like horizontal); front `features/demo/importTemplates.test.ts` (committed workbooks ≡ snapshot, vertical transposes to twin); front `UploadBatchComponent.test.tsx` (links render); e2e spec "downloadable import templates are served".

### 2.3 Transposed (vertical) XLSX parsing — both parsers

- `api-server/batch-parsing/file_parser.py` (M) — `_header_match_count` refactor, `_is_transposed_matrix` (`TRANSPOSED_MIN_MATCHES = 3`; vertical score must strictly beat best horizontal row; ambiguous → horizontal); transposed sheets are `transpose()`d in-memory then run through the standard header-row pipeline.
- `front-cards/features/demo/demoSpreadsheetParser.ts` (M) — mirrors it: `headerMatchCount`, `isTransposedMatrix`, `transposeMatrix`, applied in `parseXlsxBuffer` before `matrixToTable`.
- `front-cards/features/demo/xlsxTestHelper.ts` (NEW, test-only) — builds minimal .xlsx via JSZip; styled-but-empty cells emitted as self-closing `<c r=".." s="N"/>` (the 2026-07-16 regression shape).
- Tests: python `TransposedMatrixDetectionTests` (5: clear vertical/horizontal, ambiguous tie, below min matches, single column), `TransposedXlsxParsingTests` (4: horizontal twin, transposed golden ≡ `golden_expected.json`, **transposed + explicit `--mapping` combined**, **`--inspect` on a transposed file reports the flipped headers**); front `demoSpreadsheetParser.test.ts` "transposed (vertical) xlsx" describe, `goldenParserParity.test.ts` transposed-golden spec.

### 2.4 `.vcf` vCard import — both parsers

- `api-server/batch-parsing/file_parser.py` (M) — `.vcf` branch in `parse_file`: `_vcf_logical_lines` (3.0/4.0 whitespace unfolding + 2.1 quoted-printable soft breaks), `_vcf_qp_decode` honoring `CHARSET=`, `_vcf_parse_property` (2.1 bare tokens + 3.0/4.0 `TYPE=`), `_vcf_assign_tel` (CELL→`mobile_phone`, WORK/untyped→`work_phone`, ext via `EXT=`/`X-EXTENSION=` param or "ext. N" suffix → `work_phone_ext`; HOME/FAX/PAGER → unmapped), `_vcf_assign_adr` (WORK→`business_address_*`, else `address_*`), `_parse_vcf_card` (N/FN/ORG/TITLE/TEL/EMAIL/ADR/URL/NOTE/BDAY/X-EXTENSION → canonical ids; VERSION/PRODID/REV ignored; PHOTO/LOGO/KEY/SOUND → `<media omitted>`; everything else → `vcf_unmapped` column → record `extra`). Multi-card → one row per card; truncated final card best-effort; garbage → empty DataFrame.
- `front-cards/features/demo/demoSpreadsheetParser.ts` (M) — parallel `parseVcf(text)` with the same mapping table; `.vcf` now parsed instead of rejected.
- `api-server/batch-parsing/fixtures/vcf_samples.json` + `front-cards/features/demo/fixtures/vcf_samples.json` (NEW, byte-identical) — shared py↔ts contract: 7 cases (`vcard30_simple`, `vcard21_quoted_printable`, `vcard40_folding_and_escapes`, `multi_contact`, `phone_type_distribution`, `malformed_cards_best_effort`, `unknown_properties_to_extra`), synthetic data only.
- `api-server/tests/features/batch-upload/validators.test.ts` (M) — `.vcf` acceptance clarified with a real vCard buffer.
- Tests: python `VcfParsingTests` (shared-fixture subTests, unmapped→`extra`, garbage no-crash); front `vcfParserParity.test.ts` (same 7 cases + `vcf_unmapped` exposure + empty content); front `demoSpreadsheetParser.test.ts` `.vcf` spec.

### 2.5 Unmapped-column preservation (no more silent drops)

- `api-server/batch-parsing/parser.py` (M) — `map_row`: after explicit/alias/canonical/fuzzy passes, every unclaimed header with a non-blank cell lands verbatim in `mapped["extra"]` (raw header → value, `.0` float suffix stripped); file-level `self.unmapped_columns` accumulator (deliberate `ignore`s excluded); `store_record` passes `record.get('extra')` to Cassandra instead of hard-coded `{}`; parse-report JSON gains `unmapped_columns` (sorted).
- `api-server/src/features/batch-parsing/services/batchParsingService.ts` (M) — `BatchParsingResult.unmapped_columns` surfaced.
- `api-server/src/features/batch-parsing/services/workerService.ts` (M) — job result gains `unmappedColumns`.
- Demo mode never dropped raw headers (kept as-is); the Normal-mode drop at parser.py:435 was the bug fixed here.
- Tests: python `UnmappedColumnPreservationTests` (4).

### 2.6 Field mapping — backend (preview, explicit override, presets)

- `api-server/batch-parsing/parser.py` (M) — CLI: `--mapping <path>` (explicit JSON mapping, `load_explicit_mapping` validates targets against canonical ids + `'ignore'`, hard error on typo listing valid ids) and `--inspect` (local-file column analysis, prints `inspect_file_columns` JSON; no DB needed — `--batch-id/--postgres-url/--cassandra-hosts` now optional when `--inspect` is given). `map_row` Pass 0: explicit mapping consulted before alias/canonical/fuzzy; `IGNORE_TARGET = 'ignore'` claims a column into `extra` without counting as a gap.
- `api-server/src/features/batch-import/services/fieldMapping.ts` (NEW) — `normalizeHeaderKey`, `computeMappingSignature` (FNV-1a 32-bit of sorted normalized headers), `getCanonicalTargetFields` (loads the snapshot via `resolveBatchParsingPath`), `validateFieldMappings` (unknown target → `FieldMappingValidationError`), `toPythonMappingPayload`.
- `api-server/src/features/batch-import/services/batchImportService.ts` (M) — `previewFile` (temp file → `batchParsingService.inspectFile` → signature → suggested preset), `listPresets`/`createPreset` (server-computed signature, name ≤120)/`deletePreset` (404 non-owner).
- `api-server/src/features/batch-import/routes.fastify.ts` (M) — NEW routes (all 401 without `request.user`): `POST /api/batch-import/preview` (multipart; implemented without `:id` — analysis runs before a batch exists), `GET/POST /api/batch-import/mappings/presets`, `DELETE /api/batch-import/mappings/presets/:id`; `FieldMappingValidationError` → 400 `INVALID_MAPPING`.
- `api-server/src/features/batch-import/types.ts` (M) — `MappingConfidence`, `ColumnAnalysis`, `InspectColumnsResult`, `FieldMappingPresetDto`.
- `api-server/src/features/batch-parsing/services/batchParsingService.ts` (M) — `BatchParsingOptions.mapping` written to temp JSON and passed as `--mapping` to python; new `inspectFile(localFilePath)` spawning `parser.py --inspect`.
- `api-server/src/features/batch-upload/routes.fastify.ts` (M) — `POST /api/batches/upload` accepts optional multipart field `mapping` (JSON), validated; invalid → 400.
- `api-server/src/features/batch-upload/services/batchUploadService.ts` (M) — persists mapping as `Batch.fieldMapping`, includes it in the Bull job; `retryBatch` re-applies the persisted mapping.
- `api-server/src/features/batch-upload/{types.ts,repositories/batchRepository.ts}` (M) — `mapping?: FieldMapping[]` threaded; `fieldMapping` JSON persisted.
- Tests: `tests/features/batch-import/fieldMapping.test.ts` (8), `tests/features/batch-import/batchImportRoutes.test.ts` (9: preview auth/NO_FILE/INSPECT_FAILED/preset suggest, preset CRUD), `tests/features/batch-upload/mappingThreading.test.ts` (3: upload persists + enqueues, retry re-applies); python `ExplicitMappingTests` (4), `LoadExplicitMappingTests` (3), `InspectFileColumnsTests` (2).

### 2.7 Field mapping — frontend (modal, upload + paste, presets)

- `front-cards/features/batch-upload/components/FieldMappingModal.tsx` (NEW) — heading "Adjust Field Mapping"; one `<select aria-label="Map column <name>">` per column with options `— Ignore —` + 30 canonical fields labeled `"{labelEn} / {labelEs}"`; preselection priority suggested preset → autoField → Ignore; up to 3 sample values per column; "Save this mapping as preset" checkbox → name input (required); confirm "Apply mapping"; Escape/backdrop close; English-only copy.
- `front-cards/features/batch-upload/components/UploadBatchComponent.tsx` (M) — kicks off `batchService.previewBatchFile(file)` in parallel with the name prompt (preview failure only warns); auto-opens the modal **only when any column has `confidence === 'none'`**; paste flow (`onPaste` + document listener while hovering; clipboard file preferred, else text → `pasted-content.txt`); `handleConfirmMapping` saves the preset first (failure warns, upload not lost) then uploads with mapping.
- `front-cards/features/batch-upload/components/NameBatchModal.tsx` (M) — new `onAdjustMapping?` prop → "Adjust mapping" button (always available when a preview exists).
- `front-cards/features/batch-upload/services/batchService.ts` (M) — `previewBatchFile` (demo: client-side parse + `analyzeHeaders` + `suggestDemoMappingPreset`; normal: `POST /api/batch-import/preview`), `saveMappingPreset` (demo: localStorage; normal: `POST .../mappings/presets`), `uploadBatch(..., mapping?)`.
- `front-cards/features/batch-upload/utils/mappingSignature.ts` (NEW) — `normalizeHeaderKey` / `computeMappingSignature` / `snakeToCamel` / `camelToSnake`; mirrors api-server `fieldMapping.ts` exactly so presets match across modes.
- `front-cards/features/batch-upload/utils/canonicalTargetFields.ts` (NEW) — 30-field snapshot for the modal dropdowns.
- `front-cards/features/batch-upload/types/index.ts` (M) — `FieldMappingEntry`, `ColumnMappingAnalysis`, `CanonicalTargetField`, `FieldMappingPreset`, `MappingPreview`, `MAPPING_IGNORE_TARGET`.
- `front-cards/features/demo/demoSpreadsheetParser.ts` (M) — `analyzeHeaders` (per-column `{sourceColumn, autoField, confidence, sampleValues}`); `mapRowToContactFields` `explicitMapping` option (normalized-key lookup wins; `ignore` claims without positional re-add; uncovered columns fall through to alias/fuzzy).
- `front-cards/features/demo/demoMappingPresets.ts` (NEW) + `demoStore.ts` (M) — localStorage presets at `ecards:demo:u:<userId>:mappingPresets` (per-user); `suggestDemoMappingPreset` = first preset whose signature matches.
- `front-cards/features/demo/demoBatchRepository.ts` (M) — `uploadBatch(..., mapping?)` threads `explicitMapping` into `mapRowToContactFields`.
- `front-cards/features/demo/demoBatchRepository.test.ts` (NEW) — round-trips through the demo TS service layer: multi-card `.vcf` upload → one stored record per card with mapped fields; explicit mapping (and `ignore`) applied to uploaded records with raw columns kept.
- Tests: `FieldMappingModal.test.tsx` (7), `mappingSignature.test.ts` (4: incl. order/case stability), `demoMappingAnalysis.test.ts`, `demoMappingPresets.test.ts` (5: incl. per-user isolation), `UploadBatchComponent.test.tsx`.

### 2.8 Template kinds (`template` vs `design`) + fork-on-save

- `api-server/prisma/schema.prisma` (M) — `TemplateMetadata.kind String @default("design")` + migration (§4).
- `api-server/src/core/prisma/client.ts` (M) — `createOrUpdateTemplate` accepts `kind`; new `getTemplateById(id)` (no owner scoping — callers enforce access); `listTemplates` accepts `kind` + `includeGlobals`.
- `api-server/src/features/template-textile/services/unifiedTemplateStorageService.ts` (M) — `TemplateKind` + `toTemplateKind()` (unknown → `'design'`), kind threaded through save/list/load DTOs.
- `api-server/src/features/template-textile/controllers/templateController.ts` (M) — validates `kind ∈ {template, design}` on save (400 otherwise); `?kind=` filter on list.
- `front-cards/features/template-textile/types/index.ts` (M) — `TemplateKind = 'template' | 'design'`.
- `front-cards/features/template-textile/utils/templateSaveIntent.ts` (NEW) — `resolveSaveIntent`: explicit "Save as new template" → always new item kind `template` (deduped name); opened-from-template → fork new **design** named `"<source> copy"` (`(n)` dedup via `resolveUniqueTemplateName`, never returns the source name); otherwise save in place as design.
- `front-cards/features/template-textile/stores/templateStore.ts` (M) — `openedFromTemplate {id,name} | null` state, set on open when `kind === 'template'`, cleared on create/load.
- `front-cards/features/template-textile/components/Canvas/CanvasControls.tsx` (M) — calls `resolveSaveIntent` before persisting; after saving a new template re-arms the fork marker (future saves fork again); global flag only sent when role-gated AND kind is template.
- `front-cards/features/template-textile/components/SaveModal/SaveTemplateModal.tsx` (M) — "Save as new template" checkbox, nested role-gated "Global (all users)" sub-checkbox, `"<name> copy"` suggestion + fork hint.
- `front-cards/features/template-textile/components/OpenModal/OpenTemplateModal.tsx` (M) — kind filter pills **All | Templates | My designs** (`role="group" aria-label="Filter by kind"`), purple `Template` / gray `Design` badges, legacy kind-less items shown as designs.
- `front-cards/features/template-textile/services/{templateService.ts,browserStorageService.ts}` (M) + `features/demo/demoTemplateRepository.ts` (M) — `kind` on metadata everywhere; missing/legacy kind defaults to `'design'` (backward-compatible read).
- Tests: api `templateKind.test.ts` (6, route-level), `templateKindOperations.test.ts` (4, prisma-client layer); front `templateSaveIntent.test.ts` (6), `templateFork.test.ts` (fork lifecycle), `SaveTemplateModal.test.tsx` (M), `OpenTemplateModal.test.tsx` (NEW), `demoTemplateRepository.test.ts` (M).

### 2.9 Roles plumbing (`appsuper` / `appglobal`)

- `api-server/src/core/middleware/authMiddleware.ts` (M) — `AuthenticatedUser.roles: string[]`; exported `extractAccessToken()` + `decodeAppRolesFromToken()` (base64url-decodes JWT payload `app_roles`, no signature check — the userinfo call already established validity; malformed → `[]`); `fetchAndCacheUser` populates roles. Rendering path only.
- `api-server/src/core/middleware/requireAppRole.ts` (NEW) — authoritative Fastify preHandler: POSTs `{token}` to the validate-token endpoint; no token → 401; endpoint error/non-OK/throw → **503 `{code:'role_validation_unavailable'}` (fail-closed)**; `valid !== true` → 401; `canManageGlobalTemplates(roles)` = `roles.includes('appsuper') || roles.includes('appglobal')` (either, deny by default, no implication mapping) else 403 `{code:'insufficient_role'}`; on success sets request flag `GLOBAL_TEMPLATES_AUTHORIZED`. Endpoint from `OAUTH_VALIDATE_TOKEN_ENDPOINT`, default `${origin(OAUTH_USER_INFO_ENDPOINT)}/auth/internal/oauth/validate-token`.
- `front-cards/shared/lib/appRoles.ts` (NEW) — same decode + `canManageGlobalTemplates` for the UI.
- `front-cards/app/api/auth/user/route.ts` (M) — after userinfo, `user.roles = decodeAppRolesFromToken(accessToken)` (UI hint only).
- `front-cards/shared/lib/normalizeOAuthUser.ts` (M) + `shared/types/auth.ts` (M) + `features/auth/AuthContext.tsx` (M) — `roles` passthrough (string arrays only), `AuthContext` exposes `roles` + `canManageGlobalTemplates`; unknown future roles ignored.
- Tests: api `tests/core/middleware/appRoles.test.ts` (5), `tests/core/middleware/requireAppRole.test.ts` (10: incl. 503 fail-closed, revoked → 401/403, either-role acceptance); front `shared/lib/appRoles.test.ts`, `normalizeOAuthUser.test.ts` (M), `app/api/auth/user/route.test.ts`, `features/auth/AuthContext.test.tsx` (grant/deny/unknown-role cases).

### 2.10 Global templates (API channel, `isPublic`)

- `api-server/src/features/template-textile/routes/templateRoutes.ts` (M) — `gateGlobalSave` preHandler on `POST /api/v1/template-textile` (calls `requireAppRole` only when `body.global === true`); `gateGlobalDelete` on `DELETE /api/v1/template-textile/:id` (DB lookup of `isPublic`, gated when true). `GET` list/load stay `requireAuth`-only — globals visible to all authenticated users.
- `api-server/src/features/template-textile/services/unifiedTemplateStorageService.ts` (M) — defense in depth: save checks the `GLOBAL_TEMPLATES_AUTHORIZED` request flag before creating/overwriting a global (else 403 `insufficient_role`); `loadTemplate` owner-or-isPublic read access; `listTemplates` merges `{userId} OR {isPublic}`; delete re-checks the flag for `isPublic` rows. Regular users saving over a global get a fork (new per-user copy), never an overwrite.
- `api-server/src/features/template-textile/controllers/templateController.ts` (M) — `global` flag parsing (defaults `kind:'template'` when global), propagates `statusCode`/`code`, delete maps 403.
- `api-server/prisma/migrations/20260812_add_template_is_public/` (NEW) — §4.
- Front: role-gated UI in `CanvasControls`/`SaveTemplateModal` ("New global" only for supers, hidden in demo mode), emerald `Global` badge + delete affordance in `OpenTemplateModal` (only `canManageGlobalTemplates && isPublic && !isBundled`, `window.confirm`, list refresh). Regular users open globals read-only-by-convention: `kind:'template'` triggers fork-on-save ("Save as copy").
- Tests: api `tests/features/template-textile/globalTemplates.test.ts` (13: list merge, save/delete gating, owner-or-isPublic read); front `OpenTemplateModal.test.tsx`, `SaveTemplateModal.test.tsx`.

### 2.11 Bundled global templates (server-independent channel)

- `front-cards/public/templates/globals/manifest.json` (NEW; currently `[]`) + directory for operator-dropped `<name>.zip` (exact Export-feature output) + same-named `<name>.png` preview.
- `front-cards/scripts/build-global-templates-manifest.mjs` (NEW) — scans the directory for `*.zip`, pairs optional same-named `.png`, preserves existing `description`s, rewrites `manifest.json`; manual step, intentionally NOT wired into `package.json`. Run: `docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && node scripts/build-global-templates-manifest.mjs"`.
- `front-cards/features/template-textile/services/bundledTemplatesService.ts` (NEW) — fetches `/templates/globals/manifest.json` (`cache:'no-store'`); ids `bundled:<file>`; validates each ZIP via `zipContainsTemplate` (JSZip, must contain `template.json`) — corrupt/missing entries skipped with console warning, never breaks the gallery; metadata `{userId:'global', kind:'template', isBundled:true}`; `loadBundledTemplate` imports the ZIP through the existing `templatePackageService.importPackage` JSZip path (same as the editor Import feature).
- `front-cards/features/template-textile/components/OpenModal/OpenTemplateModal.tsx` (M) — merges `[...bundledList, ...apiList]` (bundled first); bundled entries badged `Global`, no delete button; opening forks to local on save.
- `front-cards/features/template-textile/services/templateService.ts` (M) — routes `bundled:` ids to the service; demo-mode list merges API globals best-effort; `loadServerTemplate()` fallback for API globals in demo.
- Tests: `bundledTemplatesService.test.ts` (valid entries, corrupt/missing ZIP skipped, manifest failure → `[]`, load through real JSZip path, throws on missing ZIP); `OpenTemplateModal.test.tsx` (merged + badged, delete only for supers on API globals); e2e specs "bundled global templates manifest is served and valid" + "template gallery survives a corrupt bundled-globals manifest".

### 2.12 Test infra + misc

- `api-server/jest.config.js` (M) — ts-jest `diagnostics.exclude: ['**/unifiedTemplateStorageService.ts']` for 2 pre-existing tsc errors (TS2367/TS2322) at HEAD; `tsc --noEmit` still reports them (documented deviation, out of scope).
- `api-server/tests/core/integrations/appLibraryStorageIntegration.test.ts` (M) — Pass 0 env-leak fix (`NEXT_PUBLIC_DEMO_MODE` tracked/deleted; isolates env per test).
- `front-cards/e2e/smoke.spec.ts` (M) — 3 new specs (total 6): template xlsx served (PK magic), bundled manifest valid, gallery survives corrupt manifest.
- `front-cards/features/demo/demoStore.ts` (M) — `mappingPresets` storage key.
- Docs (already updated): `README.md`, `.work/docs/runbooks/operations-runbook.md` (incl. bundled-globals drop procedure + `curl validate-token` smoke), `.work/plans/RISK_REGISTRY.md` (R2 closed, R11–R15 opened), `.work/plans/NEXT.md`.
- Dead code unchanged: `api-server/src/features/batch-import/routes.ts` + `controllers/` (Express duplicate, not registered in `app.ts`) — deletion pending owner approval.

## 3. Walkthrough test matrix

Legend: **A** = automated coverage, **M** = manual steps. Demo mode = enable demo (demo login / `localStorage['ecards:demo:enabled']='1'`); Normal mode = real OAuth login + api-server.

### 3.1 Import template downloads (rows / columns)

- **A:** front `features/demo/importTemplates.test.ts` (committed workbooks ≡ canonical snapshot; vertical transposes to identical table; example contact maps to usable fields); python `ImportTemplateTests`; front `UploadBatchComponent.test.tsx` (both links render); e2e spec "downloadable import templates are served" (200, PK magic).
- **M (both modes):** open the upload modal (dashboard → Upload Batch) → click "Download template (rows)" → open the file: row 1 = 30 snake_case headers, row 2 = one example contact (Example Person), comment on A1. Click "Download template (columns)" → headers down column A, example in column B. Fill either with 2–3 contacts, upload it → batch parses with all columns mapped (no mapping modal should auto-open).

### 3.2 Transposed XLSX import

- **A:** python `TransposedMatrixDetectionTests` + `TransposedXlsxParsingTests` (incl. styled-empty-cell regression shape + golden parity + transposed-with-explicit-mapping + inspect-on-transposed); front `demoSpreadsheetParser.test.ts` "transposed (vertical) xlsx" + `goldenParserParity.test.ts` transposed spec.
- **M (Demo):** upload the filled `import-template-vertical.xlsx` (or any sheet with headers in column A, ≥3 recognizable, contacts in columns B+) → records identical to the horizontal twin.
- **M (Normal):** same file through `POST /api/batches/upload` → batch records match the horizontal twin; check parse report has no `unmapped_columns`.

### 3.3 `.vcf` import

- **A:** python `VcfParsingTests` + front `vcfParserParity.test.ts` (shared 7-case fixture: 2.1 quoted-printable accented names, 3.0, 4.0 folding/escapes, multi-card, phone-type distribution, malformed best-effort, unknown props → extra); front `demoSpreadsheetParser.test.ts` `.vcf` spec; front `demoBatchRepository.test.ts` (multi-card `.vcf` → one stored batch record per card through the demo service layer); api `validators.test.ts` (.vcf accepted).
- **M (Demo):** export phone contacts (or craft a multi-card `.vcf`) → upload → one batch record per card; accented 2.1 names decode correctly; `X-EXTENSION`/`ext. N` lands in work-phone-ext.
- **M (Normal):** same through the api → same record count; unknown vCard properties visible in record `extra` (not dropped).

### 3.4 Field mapping modal (upload AND paste)

- **A:** front `FieldMappingModal.test.tsx` (preselection, EN/ES labels, preset beats auto, confirm mapping, preset-name required); `demoMappingAnalysis.test.ts` (explicit beats alias, ignore, fall-through); `demoBatchRepository.test.ts` (explicit mapping + ignore applied to stored demo records); api `batchImportRoutes.test.ts` (`POST /api/batch-import/preview` incl. suggest); python `ExplicitMappingTests` / `LoadExplicitMappingTests` / `InspectFileColumnsTests`.
- **M — upload, unmapped auto-open (both modes):** upload a spreadsheet whose headers match nothing (e.g. `Código Empleado`, `Qzzx Wvln`) → after naming the batch the "Adjust Field Mapping" modal opens automatically (some column has confidence none) → pair columns to vCard fields via dropdowns (labels show EN/ES) → Apply mapping → records carry the mapped fields.
- **M — Adjust mapping button (both modes):** upload any file → in the name modal click "Adjust mapping" → modal opens even when fully auto-mapped.
- **M — ignore column:** set a column to `— Ignore —` → its values land in record `extra` verbatim (Normal: check record extra / `unmapped_columns` excludes it).
- **M — paste flow:** copy tabular text → Ctrl-V over the drop zone → name prompt → same mapping modal behavior as upload.
- **M — save preset + auto-suggest on re-upload:** in the modal check "Save this mapping as preset", name it, apply → upload a second file with the same headers in different order/casing → modal preselects the saved preset's mapping automatically (signature match). Demo: preset persists in localStorage `ecards:demo:u:<userId>:mappingPresets`; Normal: `GET /api/batch-import/mappings/presets` lists it; delete via UI/API → no longer suggested.

### 3.5 Template kinds (save-as-template vs design, fork-on-save, gallery)

- **A:** api `templateKind.test.ts` + `templateKindOperations.test.ts`; front `templateSaveIntent.test.ts` (all branches), `templateFork.test.ts` (fork lifecycle incl. re-arm), `SaveTemplateModal.test.tsx`, `OpenTemplateModal.test.tsx` (filters/badges, legacy kind-less → design), `demoTemplateRepository.test.ts`.
- **M:** in the designer (`/template-textile/...`), Save with "Save as new template" checked → gallery (Open Template) shows it under "Templates" pill with purple `Template` badge → open it, change something, Save → a NEW design named `<template> copy` is created (the template itself is unchanged) → open a design → Save updates it in place → gallery "My designs" filter shows only designs.

### 3.6 Global templates (API channel + roles gating)

- **A:** api `globalTemplates.test.ts` (13: merge, save/delete gating, read access), `requireAppRole.test.ts` (10: 401/403/503 fail-closed, either-role), `appRoles.test.ts`; front `AuthContext.test.tsx`, `appRoles.test.ts`, `route.test.ts`, `OpenTemplateModal.test.tsx` (delete only for supers, only API globals), `SaveTemplateModal.test.tsx` (Global hidden without role).
- **M — super creates global (Normal):** log in as a user with `appsuper` or `appglobal` in tools-dashboard → designer → Save → check "Save as new template" → "Global (all users)" appears → save → gallery shows emerald `Global` badge and a trash icon.
- **M — regular user (Normal):** log in without those roles → the global appears in the gallery (badge, no trash icon) → open it → Save produces a personal fork ("Save as copy"); direct `POST /api/v1/template-textile {"global":true}` with their token → 403 `insufficient_role`.
- **M — delete gating:** regular user `DELETE /api/v1/template-textile/<global-id>` → 403; super → 200.
- **M — fail-closed:** point `OAUTH_VALIDATE_TOKEN_ENDPOINT` at an unreachable URL → super's global save attempt → 503 `role_validation_unavailable` (never silently allowed).
- **M — deny by default:** token without `app_roles` claim → global UI entirely hidden; mutations 403.

### 3.7 Bundled global templates

- **A:** front `bundledTemplatesService.test.ts` (incl. corrupt/missing ZIP skipped, manifest failure → `[]`); `OpenTemplateModal.test.tsx` (merged + badged); e2e "bundled global templates manifest is served and valid" + "template gallery survives a corrupt bundled-globals manifest".
- **M (operator, both modes):** in the designer use Export to get `<name>.zip` → copy it + a `<name>.png` preview into `front-cards/public/templates/globals/` → run `docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && node scripts/build-global-templates-manifest.mjs"` → check `manifest.json` gained the entry → open the gallery (Demo AND Normal) → the bundled template appears first, badged `Global`, preview image shown, no delete button → open it → Save forks a local copy → the bundled original is untouched.
- **M — resilience:** add a corrupt `broken.zip` + rebuild manifest → gallery still loads; entry hidden; browser console shows a warning.

### 3.8 Unmapped-column preservation

- **A:** python `UnmappedColumnPreservationTests` (4); threaded via `batchParsingService`/`workerService` (`unmappedColumns` in job result).
- **M (Normal):** upload a sheet with an unmappable column (e.g. `Legacy Code`) without mapping it → batch records show the column's values under `extra` with the original header; parse report/job result lists it under `unmapped_columns`. Pre-fix behavior was a silent drop.

### 3.9 Env example var

- **A:** none (example files only).
- **M:** `grep OAUTH_VALIDATE_TOKEN_ENDPOINT .env.dev.example .env.demo.example .env.prd.example` → present in all three with per-env URLs and a comment documenting the default derivation from `OAUTH_USER_INFO_ENDPOINT`. Real `.env*` edits are flagged for the owner.

## 4. Migration / DB changes (`api-server/prisma/migrations/`, all idempotent, `migrate status` = 5 migrations up to date)

1. `20260812_add_template_is_public/migration.sql` — `ALTER TABLE "template_metadata" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;` — revives the dormant `isPublic` schema field as the global-template flag (was declared in schema but never migrated; dev DB drift was baselined via `migrate resolve` first).
2. `20260812_field_mapping_presets/migration.sql` — `ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "field_mapping" JSONB;` (per-batch mapping override, re-applied on retry) + `CREATE TABLE IF NOT EXISTS "field_mapping_presets"` (`id` PK, `user_id` NOT NULL, `name` NOT NULL, `signature` NOT NULL, `mapping` JSONB NOT NULL, timestamps) + indexes `field_mapping_presets_user_id_idx` and `field_mapping_presets_user_id_signature_idx` + FK → `users(id)` CASCADE (guarded by `pg_constraint` check).
3. `20260812_template_metadata_kind/migration.sql` — `ALTER TABLE "template_metadata" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'design';` — `'template' | 'design'`; existing rows become `'design'`.

Schema touchpoints: `api-server/prisma/schema.prisma` (`Batch.fieldMapping Json?`, `FieldMappingPreset` model + `User.fieldMappingPresets` relation, `TemplateMetadata.kind`).

## 5. Env / config changes

- `OAUTH_VALIDATE_TOKEN_ENDPOINT` added to all three example files (no root `.env.example` exists): `.env.dev.example` (`https://dev.aiepic.app/auth/internal/oauth/validate-token`), `.env.demo.example` + `.env.prd.example` (`https://tools.datawork.top/auth/internal/oauth/validate-token`). Each carries a comment: full URL; default when unset = origin of `OAUTH_USER_INFO_ENDPOINT` + `/auth/internal/oauth/validate-token`.
- Real `.env*` files intentionally untouched (flagged for owner).
- `OAUTH_SCOPES` unchanged (`profile email subscription` suffices; roles ride the `app_roles` JWT claim).
- `api-server/jest.config.js` diagnostics exclusion (see 2.12). No changes to `package.json`, compose, Dockerfiles, `next.config.ts`, `tsconfig.json`, workflows.

## 6. Known residuals / needs-live-verification

- **Playwright full run:** dev containers are Alpine (musl) — Playwright's glibc chromium can't exec there; specs verified via `--list` (6/6 compile). Full suite runs in the CI ubuntu job `front-cards-e2e`. Needs CI confirmation.
- **Real `app_roles` claim:** verify tools-dashboard actually issues `app_roles` for the ecards `client_id` in dev (`http://localhost:8082`) and prd before relying on the global-templates UI; feature is hidden by design when the claim is absent.
- **Browser click-throughs:** the full manual matrix in §3 (mapping modal on upload + paste, preset save/re-suggest, template fork, global create/fork/delete, bundled drop) has jest-level coverage but only the 3 new e2e specs are browser-level; live click-through still recommended.
- **Demo-mode upload + API-global flows need a live tools-dashboard login** — covered by lighter checks + jest; gap documented in plan §9.
- **Express stub deletion pending:** `api-server/src/features/batch-import/routes.ts` + `controllers/` (dead Express duplicate) still in tree — deletion requires owner approval (A7).
- **Pre-existing tsc errors:** 2 in `unifiedTemplateStorageService.ts` (TS2367/TS2322) excluded from ts-jest diagnostics; still reported by `tsc --noEmit` on api-server (front tsc is clean). Out of scope.
- **Committed-template golden check skips in-container** (`front-cards/` not mounted in api-server container); runs on host/CI full checkouts.
- **`is_public` legacy audit:** column defaulted false and was never read before; if a non-dev DB ever had hand-set `is_public=true` rows, audit before enabling (risk registered in `.work/plans/RISK_REGISTRY.md`).
