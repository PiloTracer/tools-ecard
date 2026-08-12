# Feedback — review of uncommitted files (2026-08-11)

**Source:** agent review of the dirty working tree on `main` (HEAD `247357a`), requested by owner. Read-only review — no code modified. Includes a full claim-by-claim verification of `.work/plans/20260812-import-ux-templates-plan.md`, with the three baseline suites re-run live in the dev containers (§6).
**Date:** 2026-08-11 (local; suites re-run 2026-08-12 UTC) · **Scope:** all 5 uncommitted paths + load-bearing plan claims cross-checked against the repo.

## Files reviewed

| Path | State | Role |
|------|-------|------|
| `.work/context/HANDOFF.md` | M (+4) | Adds `**Open:** 2026-08-11 — UI layer session` line |
| `.work/plans/NEXT.md` | M (+1) | Adds 2026-08-12 intake line for the import-ux plan |
| `.work/plans/20260812-import-ux-templates-plan.md` | untracked | Draft v2, "awaiting approval", Passes 0–6 |
| `.work/prompts/20261011-new-import-features/prompt.md` | untracked | Original `@x-director` task brief |
| `qwen-code-export-2026-08-12T01-33-04-726Z.md` | untracked (repo root) | 418 KB chat-session export; plan's stated provenance |

---

## 1. Critical issues (factual problems that can bite)

### 1.1 Plan A3 precondition "already migrated" is unsupported — column exists only in schema
- Plan §3 A3: "Revive the dormant `TemplateMetadata.isPublic` column (line 84, **already migrated**)… audit query in Pass 5 confirms no legacy `true` rows".
- Evidence: `api-server/prisma/schema.prisma:84` does declare `isPublic Boolean @default(false) @map("is_public")`, but **no migration contains `is_public`** — `api-server/prisma/migrations/` holds only `20250118_template_designer` and `20251127_add_project_phone_config`.
- Implication: schema-vs-DB drift is likely; the column may not exist in the dev/prd database at all. The Pass 5 "audit query" would fail against a missing column. Pass 0 must run `prisma migrate status` / `migrate diff` and create the missing migration before Pass 5 relies on it.
- Status: `open` · Priority: **high** (fix plan text + add Pass 0 precondition).

### 1.2 Plan endpoint strategy is inconsistent (A7 vs Pass 3)
- Plan §3 A7: "Flesh out the existing placeholder `api-server/src/features/batch-import/` (routes already stubbed: `/:id/preview`, `/:id/mappings/suggest`, `/:id/validate`)".
- Plan §4 Pass 3 proposes **different** endpoints: `POST /api/batches/preview-mapping`, `POST /api/batches/upload` (mapping override), `GET/POST/DELETE /api/field-mappings` — never reconciled with the stubs.
- Repo reality: two parallel placeholder implementations exist —
  - Fastify (live): `api-server/src/features/batch-import/routes.fastify.ts` + `services/`, mounted at `app.ts:144` (`/api/batch-import`).
  - Express (dead): `batch-import/routes.ts` + `controllers/`, self-documented "Express routes are unused" (authMiddleware is Fastify middleware).
- Implication: "flesh out the placeholder" is ambiguous — reuse/extend the mounted Fastify stubs, or create new endpoints and deprecate the old? Leaving both live invites drift. Plan must state which routes survive; recommend: implement on the Fastify router (extend `/:id/*` or add the new names) and delete/ignore the Express copy.
- Status: `open` · Priority: **high**.

### 1.3 Plan provenance file sits at repo root, untracked
- Plan header: "rebuilt from the export `qwen-code-export-2026-08-12T01-33-04-726Z.md`". That file is a 418 KB full agent chat log (tool I/O included) at **repo root**, untracked.
- `.cursorrules` §Data Privacy & Security: "Exports go to `tmp/`, not the source tree."
- If the plan is committed, the provenance reference dangles (file not in `.work/`, won't be in the session commit). Recommend moving it to `tmp/` (or `.work/docs/` if retention is wanted) — requires owner permission (no delete/move without explicit request per `.cursorrules`).
- Status: `open` · Priority: medium.

### 1.5 Plan Pass 0 cites a non-existent source path
- Plan §4 Pass 0 "Files": `api-server/src/features/batches/*` (upload accept list + errors) — **no `features/batches/` directory exists**. Real feature dirs are `batch-upload`, `batch-parsing`, `batch-records`, `batch-import`, `batch-view`, … The upload accept list lives in `api-server/src/features/batch-upload/types.ts` (ALLOWED_FILE_TYPES) and `routes.fastify.ts`. Fix the path in the plan before implementation.
- Status: `open` · Priority: **high** (implementation would look in the wrong tree).

### 1.4 Session bookend state is contradictory
- HANDOFF (dirty) declares `**Open:** 2026-08-11 — goal: UI layer session — UI design foundation (@ui-design-foundation greenfield)`, citing UI carriers — but `.work.ui/context/HANDOFF_UI.md` and `.work.ui/plans/NEXT_UI.md` both show **no open session** ("Open: -", Updated 2026-07-16).
- The session's actual work (per the export) was the `@x-director` import-ux verification + plan draft, under an earlier `@session-control start`. The export ends with the owner decision answers — no close, no HANDOFF/NEXT finalization for the import-ux work.
- Implication: the Open line's goal is stale relative to real work; the import-ux session is neither closed nor properly carried. Recommend `@session-control start` (correct goal) or close + reopen before Pass 0.
- Status: `open` · Priority: **high** (state hygiene before implementation starts).

---

## 2. Stale / contradictory content (HANDOFF / NEXT)

| # | Item | Evidence | Status |
|---|------|----------|--------|
| 2.1 | NEXT.md "Recommended next" **Priority 0** ("Commit framework path migration — `.cursorrules` + `.work.soc/plans/NEXT_SOC.md`… decide stale nginx row first") is **done** | HEAD `247357a .cursorrules` commits `.cursorrules` + `.work.soc/plans/NEXT_SOC.md` (+ `.qwen/settings.json`); git status shows both clean. The nginx-row decision was **not** made in that commit (row still in `.cursorrules` §Docker table) | `partial` — migration done, nginx decision still open; NEXT.md not updated |
| 2.2 | HANDOFF owner action **#7** ("commit .cursorrules migration + NEXT_SOC fix; decide nginx row") still listed Open | Same commit evidence as 2.1; nginx decision outstanding | `partial` |
| 2.3 | HANDOFF §What this cycle produced lacks the interrupted 2026-08-12 session (verifications 1–5 + plan draft) | Audit table last row = 2026-08-11 cursorrules verify | `open` |
| 2.4 | NEXT.md header "Updated: 2026-08-11 (post .cursorrules verify + close)" not bumped despite new 2026-08-12 intake line | File diff (+1) adds the intake line only | `open` (cosmetic) |
| 2.5 | `.qwen/settings.json` committed in `247357a` despite HANDOFF guidance "untracked `.qwen/` (agent tool state — keep untracked)"; `.qwen` not in `.gitignore` | `git show --stat 247357a`; `grep qwen .gitignore` → none | `open` (content is benign — permissions allowlist only) |

---

## 3. Plan gaps & recommendations (`.work/plans/20260812-import-ux-templates-plan.md`)

| # | Finding | Evidence | Recommendation | Status |
|---|---------|----------|----------------|--------|
| 3.1 | Central risk registry not updated | `.work/plans/RISK_REGISTRY.md` still shows R2 "Batch import HTTP layer still placeholder messaging — **Open**" (Pass 3 closes it); plan's new risks (role claim staleness, vCard dialect drift, transposed false positives, mapping corruption, bundled-manifest staleness, isPublic revival) are inline-only in §6 | Register/close R2 + add new risks at plan approval | `open` |
| 3.2 | No task-ref linkage possible: `.github/task-registry.json` does not exist | `ls .github/task-registry.json` → absent (matches owner action #5: FR→M{N}-T{N} gap) | Plan has no M{N}-T{N} ids; either add per-pass ids or record the traceability gap explicitly | `open` (pre-existing) |
| 3.3 | Test baseline numbers (python 35/35, front jest 215/215, api 148/1fail/3skip) not pinned to a runnable record | Plan §1 states them; HANDOFF history shows older counts (28/191/46) | Record exact command + date for the baseline so the Pass 0 gate is auditable; keep the pinned failing test file name (`appLibraryStorageIntegration.test.ts`) — already noted | `open` (hygiene) |
| 3.4 | `front-cards/public/templates/` does not exist yet; A4 "checked-in `manifest.json`" + A5 "commits outputs" imply new dirs/files | `ls front-cards/public/templates` → missing | State explicitly that Pass 1/5 create the directory + first manifest; add to Files lists | `open` (cosmetic) |
| 3.5 | New env var `OAUTH_VALIDATE_TOKEN_ENDPOINT` (A1) only implicitly covered | `.env.example` lacks it today (expected — it's new); Pass 5 says ".env.example files only" | Add `.env.example` explicitly to Pass 5 Files | `open` (cosmetic) |
| 3.6 | Demo `.vcf` rejection point not named in plan | Upload accept lists include `.vcf` (`api-server/.../batch-upload/types.ts:105`, `UploadBatchComponent.tsx:39`), but neither `file_parser.py` nor `demoSpreadsheetParser.ts` has a vcf branch → "accepted, no parser branch" is accurate | Pass 0 "honest error" should name the exact reject points (front accept-list + backend accept-list) so both modes reject consistently | `open` (clarity) |
| 3.7 | Plan says "BullMQ → Python parser" — batch parsing uses **Bull v4**, not BullMQ | `api-server/src/features/batch-upload/services/queueService.ts` imports `Bull from 'bull'`; consumer is `batch-parsing/services/workerService.ts` (`queue.process('parse-batch')`). BullMQ is render-worker's queue lib (`render-worker/src/core/queue/index.ts`) for card rendering | Correct the plan wording; also clarify the batch-parse consumer lives **inside api-server**, not render-worker | `open` (naming) |
| 3.8 | Plan says env additions to "`.env.example` files" — actual files are `.env.dev.example`, `.env.demo.example`, `.env.prd.example` | `ls .env*` → no root `.env.example`; the three per-environment examples contain `OAUTH_SCOPES` | Pass 5 must update **three** example files, not one | `open` (accuracy) |
| 3.9 | A6 parity test must reconcile three id representations; plan doesn't state the mapping | `FIELD_MAPPING` keys are snake_case (`full_name`); front `vcardFields.ts` ids snake_case (`full_name`, 30 entries); Demo `HEADER_ALIASES` targets are camelCase `keyof DemoContactFields` (`fullName` — 30 fields) | A6's "key-set equality" needs an explicit case/format normalization (or id-mapping table) or the parity test will fail on the Demo side | `open` (gap) |

## 4. Confirmations — plan claims verified against the repo (no action)

- `parser.py:435` silent drop: verified — `{}  # empty map for extra field` at line 435; unmapped columns land nowhere visible. Plan's Pass 0/3 fix direction is correct.
- `isPublic` at `schema.prisma:84` — declared (see 1.1 for the migration gap).
- `authMiddleware.ts` validates via userinfo with the access token from a cookie; plan A1 (decode `app_roles` from the JWT after validation, no signature check needed) is **feasible** as described.
- Fastify `/api/batch-import` stubs mounted (`app.ts:144`) with `preview`, `mappings/suggest`, `validate`, `status`, `import`, `cancel` — matches A7's route list (see 1.2 for the strategy gap).
- No xlsx-writer dep in either `package.json`; `jszip ^3.10.1` in front-cards — A5's "static assets via openpyxl, no exceljs" is consistent.
- Sibling roles guide exists: `/mnt/data/Projects/EPIC/tools-dashboard/.work/docs/guides/client-app-roles/README.md` — D3's reference is valid.
- Secrets scan of all 3 new text files: **clean** — no `PRIVATE KEY`/`AKIA*`/`ghp_`/`sk-`/`password=`/`client_secret=`/`api_key=` patterns. The export's 43 `.env` mentions are policy/description text, not values.

## 5. Naming / convention inconsistencies (cosmetic)

- `.work/prompts/20261011-new-import-features/` — date prefix `20261011` (2026-10-11) is ~2 months off from the actual session (export spans 2026-08-11T21:05Z → 2026-08-12T01:33Z; NEXT intake dated 2026-08-12). Likely typo for `2026081[12]`. Slug also differs from the plan slug (`new-import-features` vs `import-ux-templates`) — hard to correlate.
- Plan filename uses UTC date `20260812` while HANDOFF/NEXT use local `2026-08-11`; machine local date is 2026-08-11. Pick one convention (local date) across plan/prompt/feedback names.
- `.work/prompts/README.md` documents only `initial.md` and `decision_*_*.md`; the new `YYYYMMDD-<slug>/prompt.md` layout is undocumented — update README or rename.

---

## 6. Plan verification matrix — re-run in containers 2026-08-12 (dev stack up)

Baseline suites re-run live (`docker compose -f docker-compose.dev.yml exec …`, dev stack Up): **python 35/35 · api jest 148 pass / 1 fail / 3 skip · front-cards jest 29 suites / 215 pass / 0 fail** — all three match the plan's §1 baseline exactly. The api failure is confirmed as `tests/core/integrations/appLibraryStorageIntegration.test.ts` → "requires integration in strict production" (env-var leak), exactly as the plan states; front-cards suites = **29**, as the plan claims.

| Plan claim | Verdict | Evidence |
|-----------|---------|----------|
| §1.1 Single entry `UploadBatchComponent`; `.csv/.txt/.md/.vcf/.xls/.xlsx` ≤10 MB | ✅ | `UploadBatchComponent.tsx:39-40` (ALLOWED_EXTENSIONS, `MAX_SIZE_MB = 10`); drag/drop+browse+Ctrl-V per component; backend `ALLOWED_FILE_TYPES` `types.ts:105` |
| §1.1 Normal: `POST /api/batches/upload` → queue → Python parser → Postgres+Cassandra | ✅ | `app.ts:142` prefix `/api/batches`; `routes.fastify.ts:19` `post('/upload')`; `queueService.enqueueBatchParsing`; `workerService.ts` Bull `process('parse-batch')`; `parser.py` Postgres `INSERT INTO batch_records` + Cassandra `INSERT INTO contact_records` (prepared stmt) |
| §1.1 Demo: client-side `demoSpreadsheetParser.ts` → localStorage/IndexedDB | ✅ | `demoSpreadsheetParser.ts:6` JSZip, `parseXlsxBuffer`; `demoStore.ts` "localStorage JSON + IndexedDB blobs"; `demoTemplateRepository.ts` via demoStore |
| §1.2 Pasted formats: tabular auto-detect, KV, vertical email-anchored, multi-section, stacked | ✅ | `file_parser.py`: `_detect_delimiter`, `find_header_row`, `_match_key_value_line`, `_is_key_value_section`, `_split_text_sections`, `_is_vertical_section_title`; Demo `parseCsvText`, `parseVerticalContacts` |
| §1.3 `.txt`/`.md` both modes + operator fixtures | ✅ | `ALLOWED_FILE_TYPES` includes `.md`; fixtures `api-server/batch-parsing/fixtures/operator_batch_samples.json` + `front-cards/features/demo/fixtures/operator_batch_samples.json`; `.work/feedback/test-data.md` |
| §1.4 `.xlsx` both modes; `.xls` Normal-only; first worksheet only; no transposed support | ✅ | `file_parser.py:503-518` openpyxl→xlrd fallback (no sheet_name → first sheet); demo `parseDemoSpreadsheetFile` throws on `.xls` ("cannot parse legacy .xls"); no orient/transpose logic in either parser |
| §1.4 `.vcf` live bug: accepted, no parser branch | ✅ | `.vcf` in both accept lists; `file_parser.py` has no vcf branch; demo throws "Demo mode does not parse .vcf yet" |
| §1.5 30 vCard fields, case/separator-insensitive, EN/ES aliases, fuzzy | ✅ | `FIELD_MAPPING` = **30** keys (`data_normalizer.py:17`); `vcardFields.ts` = **30** entries; Demo `DemoContactFields` = **30** fields; fuzzy matchers both sides |
| §1.5 Three hand-synced alias tables | ✅ | Python `FIELD_MAPPING` (snake), Demo `HEADER_ALIASES`→camel targets, front `vcardFields.ts` (snake) — confirmed 3 distinct sources |
| §1.5 Normal silently drops unmapped columns (`parser.py:435` → `{}` extra) | ✅ | `parser.py:435` `{}  # empty map for extra field` |
| §2 Superuser: tools-dashboard roles guide exists | ✅ (external) | `/mnt/data/Projects/EPIC/tools-dashboard/.work/docs/guides/client-app-roles/README.md` present; "Approved SPEC 2026-08-11" status **not verifiable from this repo** |
| §3 A1: authMiddleware validates every token via userinfo; access token in cookie | ✅ | `authMiddleware.ts:1-45` — cookie `ecards_auth`, userinfo validation, 60s token cache; JWT decode approach feasible (token in hand) |
| §3 A2: `normalizeOAuthUser` whitelists fields; no roles today | ✅ | `normalizeOAuthUser.ts` returns id/username/email/display_name/avatar_url/subscription/createdAt/updatedAt — **no roles**; `User` type `auth.ts:19` has no roles field; `/api/auth/user` route exists |
| §3 A3: `isPublic` at schema line 84 | ⚠️ | `schema.prisma:84` declared; **no migration contains it** → see finding 1.1 |
| §3 A4: JSZip import path `handleImportJSON` + `templateService.saveTemplate` | ✅ | `Canvas/CanvasControls.tsx:869` `handleImportJSON`, `:283` `saveTemplate`, `:311` `updateTemplateId`, `:315` `markAsSaved`; `templateService.ts` exists |
| §3 A5: no xlsx writer dep; front has jszip; openpyxl available in api-server | ✅ | no `xlsx`/`exceljs` in either package.json; `jszip ^3.10.1` in front-cards; `api-server/batch-parsing/requirements.txt` has `openpyxl>=3.1.0`, `xlrd>=2.0.1`, `pandas>=2.0.0` |
| §3 A6: shared-types domain dir exists (target for new vcard-fields.ts) | ✅ | `packages/shared-types/src/domain/` exists (batch.ts, index.ts, project.ts, template.ts, user.ts); vcard-fields.ts is a new file |
| §3 A7: batch-import placeholder with stubbed routes | ⚠️ | Mounted Fastify stubs `app.ts:144` (`/api/batch-import`): `/:id/preview`, `/:id/mappings/suggest`, `/:id/validate`, `import`, `status`, `cancel` — plus **dead Express duplicate** `routes.ts`+`controllers/` → see finding 1.2 |
| §4 Pass 0 files | ⚠️ | `appLibraryStorageIntegration.test.ts` exists; `batch-parsing/{file_parser,parser,data_normalizer}.py` exist; but `features/batches/*` **does not exist** → see finding 1.5 |
| §4 Pass 4: `demoTemplateRepository` exists (kind-field bump target) | ✅ | `front-cards/features/demo/demoTemplateRepository.ts` present |
| §4 Pass 6: Playwright smoke + ops runbook | ✅ | `.github/workflows/ci.yml:129` "front-cards (playwright smoke)" job; `front-cards/e2e/smoke.spec.ts`; `.work/docs/runbooks/operations-runbook.md` |
| §6 Risk: Demo/Normal drift from 3 alias tables | ✅ (confirmed) | three tables verified (see §1.5 row) |
| §7 Commands: services `api-server`, `front-cards` in dev compose; `sh -c` works | ✅ | `docker-compose.dev.yml` has both services; all three suites ran via `sh -c` successfully this review |

**Unverified (external, out of repo reach — mark in plan as dependencies):** `POST /auth/internal/oauth/validate-token` behavior/contract; `app_roles` claim actually issued for the ecards `client_id` in dev/prd (plan D4 pre-check covers this — keep it); tools-dashboard roles-guide "Approved SPEC" status.

---

## Recommended next steps (owner)

1. Approve / amend the plan: fix 1.1 (isPublic migration precondition), 1.2 (endpoint strategy + dead Express routes), **1.5 (Pass 0 path `features/batches/*` → `features/batch-upload/`)**, 3.7 (Bull vs BullMQ wording), 3.8 (three `.env.{dev,demo,prd}.example` files), 3.9 (A6 casing/id normalization for the parity test), 3.1 (risk registry) — then start Pass 0.
2. Reconcile session bookends (1.4, 2.1–2.4): `@session-control start` with the real goal (import-ux planning) or close+reopen; mark NEXT Priority 0 done.
3. Decide the stale `nginx` compose-table row (2.1/2.2) — still open.
4. Move the chat export to `tmp/` (1.3) — needs explicit owner permission per `.cursorrules`.
5. Baseline is now re-verified live (§6): python 35/35, api 148/1/3, front 215/29 suites — Pass 0 gate can trust these numbers; keep the pinned failing test (`appLibraryStorageIntegration.test.ts`) as the Pass 0 acceptance item.
6. Before Pass 5, confirm the external dependencies marked Unverified (§6): `validate-token` contract + `app_roles` issuance for the ecards `client_id` (plan D4 pre-check).
