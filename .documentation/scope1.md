First, a quick note: the files you mentioned (C# WPF app, JSX, sample Excel/ZIP) show as expired on my side. If you want me to analyze or port specific logic from them, please re-upload. I’ll still include the InDesign/server idea conceptually in the scope below.

---

## 1. Project overview

**Goal:**
Web application (Indesign-style editor) to design and generate e-cards with optional QR codes, **including batch generation** from Excel/text, integrated with:

* A **central auth + subscription webapp** (already existing).
* **SeaweedFS** bucket server for storage.
* **WebSocket** channel to track user subscription status and rate limits.

**Deliverables:**

* Web frontend (e-card designer + batch manager).
* Backend APIs + batch processing engine.
* Storage integration (SeaweedFS).
* Integration with central auth/subscription and WebSocket events.
* Basic ops (Dockerized services, dev/stage/prod).

You can treat each major section below as an “epic” for Claude Code.

---

## 2. User roles & flows

### 2.1 Roles

* **End user (designer)** – designs templates, uploads batches, generates cards.
* **Account admin (in main auth app)** – manages subscriptions, limits; only indirectly relevant here.
* **System admin** – internal (you), manages SeaweedFS, configs, logs.

### 2.2 Main flows

1. **SSO Login**

   * User logs into central webapp.
   * Selects “E-Card / QR-Code Designer”.
   * Central app redirects with SSO (e.g. OAuth2 / JWT) to designer frontend.
   * Designer app establishes WebSocket connection back to central app to receive:

     * `subscription_status` (active/expired).
     * `rate_limits` (max cards per month, batch size, etc.).
   * Designer enforces limits client-side and server-side.

2. **Template creation / editing**

   * User uploads background PNG (business card background).
   * User can upload **custom fonts** (TTF/OTF) OR choose from library.
   * Canvas editor (Indesign feel):

     * Add/edit text frames, QR placeholder, optional image placeholders (e.g. logo, profile photo).
     * Configure **colors per element** (including per-word color rules).
     * Save template as reusable layout.
   * Template stored in DB as JSON (elements, coordinates, fonts, colors) + reference to background in SeaweedFS.

3. **Batch creation**

   * User selects template.
   * User creates/imports batch in one of two ways:

     1. **Excel upload** (like `staff_real.xlsx`):

        * Upload file.
        * Backend parses to canonical rows (see §5).
     2. **Text paste** (like the sample block with Nombre / Puesto / Correo / Número de teléfono):

        * User pastes plain text.
        * Backend parses to table structure.
   * User sees a **field mapping screen**:

     * Left: detected headers/fields (possibly imperfect).
     * Right: template placeholders (`name`, `position`, `email`, `phone`, `extension`, `qr_data`, etc.).
     * System proposes mappings using fuzzy logic + optional LLM (e.g. “Puesto” → `position`).
     * User can adjust manually.
   * User saves the batch; can later list, view, re-generate.

4. **Batch preview & generation**

   * User selects a batch → sees list of records.
   * Option to:

     * Preview individual card.
     * Generate all cards in batch (subject to rate limits).
   * Generation pipeline:

     * For each row, apply mapping to template placeholders.
     * Apply **phone/extension inference** (see §5.3).
     * Apply text styling rules (colors, first-word vs rest-of-text).
     * Render front-end (canvas export) or back-end (rasterization) image.
     * Optional PDF packaging (e.g. multipage PDF).
   * Output stored in SeaweedFS, accessible via download URLs.

---

## 3. Functional requirements (detailed)

### 3.1 Template management

* **Create/Edit templates**

  * Upload background PNG.
  * Editor tools:

    * Text box: position, size, font family, font size, weight, alignment, color.
    * Special **text rules**:

      * “First word in color X, rest in color Y”.
      * Maybe “last name in color X” (optional future).
    * QR placeholder box: position, size, foreground/background color.
    * Optional fixed elements (logo, icons).
  * Grid / snap-to-grid, zoom in/out, rulers.
* **Font handling**

  * Default font set (stored centrally).
  * User font upload (TTF/OTF):

    * Validated on backend.
    * Stored in user’s font bucket in SeaweedFS.
    * Registered so renderer (front and/or back end) can use it.
* **Colors**

  * Color picker (RGB/HEX).
  * Named palettes (e.g. brand colors).
* **Save template**

  * Name, description.
  * Reference to:

    * Background image location (SeaweedFS).
    * Elements array (JSON).
    * Fonts used.
  * Templates are **per user** (multi-tenant isolation) with option for global templates in future.

### 3.2 Batch management

* **Batch list view**

  * For current user:

    * Batch name, template, created date, number of records, status (draft/processed).
* **Batch details**

  * Preview table of records.
  * Quick search (by name/email).
  * Actions:

    * Generate all cards.
    * Regenerate (if template changed).
    * Download zip/PDF.
* **Import from Excel**

  * Accepts `.xlsx` (and `.csv` as stretch).
  * Supports multiple sheets (user selects sheet).
* **Import from Text**

  * Paste area.
  * Option to:

    * Indicate if first non-empty line is header row.
    * Delimiter detection (tab vs spaces vs semicolon).
  * System detects columns and builds preview table.

### 3.3 Data parsing & “loose” mapping

Goal: **failure-resilient** parsing even if headers are messy or missing.

#### 3.3.1 Deterministic parsing pipeline

1. **Structured input (Excel/CSV)**

   * Use a robust parser library (e.g. SheetJS / `xlsx`).
   * Normalize:

     * Trim whitespace.
     * Normalize accents, case.
     * Remove blank rows.
   * Candidate headers:

     * Explicit first row if mostly textual.
     * If not, synthesize headers (`Col1`, `Col2`, …).

2. **Unstructured text**

   * Heuristics:

     * Split into lines.
     * Detect **header block**: first group of lines with small number of fields repeated (e.g. 4 each).
     * Use blank lines as row separators.
     * Try splitting lines by common delimiters: `\t`, `;`, `|`, multiple spaces.
   * Fallback: treat sets of 4 lines as a record (Name / Position / Email / Phone) using known pattern.

3. **Field classification (non-LLM)**

   * For each column:

     * Check regex patterns:

       * Email.
       * Phone number (digits, `+`, `-`, spaces).
       * “Name-like” (words with capital letters, accented letters).
       * Position/title (contains common words like “Engineer”, “Gerente”, “Assistant”, etc.) – can be a configurable dictionary.
     * Use header similarity:

       * `Nombre`, `Name`, `Funcionario`, etc. → `name`.
       * `Puesto`, `Position`, `Role`, etc. → `position`.
       * `Correo`, `Email` → `email`.
       * `Teléfono`, `Phone`, `Celular`, `Mobile`, `Ext`, `Extensión` → `phone` / `extension`.
   * Generate a confidence score per mapping.

#### 3.3.2 LLM-assisted mapping (e.g. GPT-4.1-mini / Claude)

* When:

  * Headers are missing/messy or low confidence mapping.
* How:

  * Backend sends a **small sample** of rows + headers to an LLM with a constrained prompt:

    * “Return JSON that maps each input column name to one of: name, position, email, phone, extension, ignore.”
* LLM output is:

  * Validated (must be JSON with known labels).
  * Exposed in UI so user can override.

#### 3.3.3 Phone vs extension logic

* Configurable per tenant or template:

  * **Phone prefix**: e.g. `2459-`.
  * **Extension length**: typically 4 digits.
* Rules:

  1. If cell contains pattern `prefix ####` → full phone.
  2. If cell only has 4 digits and matches `[0-9]{4}` → treat as **extension**.

     * Full phone can be built as `prefix + extension`.
  3. If cell contains both (e.g. `2459-7584 / 1234`):

     * Split by `/`, `;`, or spaces.
     * Last 4-digit token without prefix → `extension`.
     * First full number → `phone`.
* UI:

  * In mapping step, show preview:

    * Phone: `2459-7584`.
    * Extension: `1234`.
  * Allow user to correct mapping.

### 3.4 Rendering & export

* **Rendering modes**

  1. **Client-side canvas rendering**:

     * React + Konva or FabricJS.
     * Export each card as PNG from canvas.
     * Pros: Less load on backend, great for preview.
     * Cons: Large batches = heavy client work.
  2. **Server-side rendering** (recommended for final batch export):

     * Node (e.g. `node-canvas`, `sharp`, or headless Chromium / Playwright render).
     * Uses same template JSON.
* **QR generation**

  * QR content per record:

    * Could be email URL, vCard, website, or custom `qr_data` field.
  * Colors from template (foreground/background).
  * Use QR library on backend (and optionally on frontend for preview).
* **Outputs**

  * Per card: PNG (300 DPI equivalent for typical card size).
  * Optional:

    * Zip of PNGs.
    * Multi-page PDF (one card per page).
  * Store in SeaweedFS with structured paths:

    * `/users/{userId}/batches/{batchId}/{recordId}.png`.

### 3.5 Subscription & rate limits integration

* On login:

  * Designer app receives a JWT with `userId` and minimal profile.
  * Designer then opens a **WebSocket** to the central auth app:

    * Subscribe to events like:

      * `subscription_updated`.
      * `limit_warning`.
      * `limit_reached`.
  * Designer keeps current limits in memory and updates UI (e.g. progress bar: “215 of 500 cards this month”).
* Backend enforcement:

  * Each batch generation request checked against server-side counters.
  * If limit exceeded:

    * Return structured error so UI can show “Upgrade to Pro to generate more cards.”

---

## 4. Non-functional requirements

* **Performance**

  * 1 batch of 200 cards must render under X seconds (define later; e.g. < 60s on server).
* **Scalability**

  * Stateless API services; can be horizontally scaled.
  * Rendering jobs queued (e.g. with Redis-backed queue).
* **Security**

  * JWT/Signed cookies from central app.
  * All calls over HTTPS.
  * Per-user isolation for templates, fonts, batches.
* **Reliability**

  * Retry friendly: if batch generation job fails mid-way, partially generated cards can be retried.
  * Logs for parsing, LLM calls, rendering.

---

## 5. High-level architecture

### 5.1 Components

1. **Frontend (SPA)**

   * React (or Next.js in SPA mode).
   * Canvas editor (Konva or FabricJS).
   * Auth:

     * Consumes JWT from central app.
     * Connects to WebSocket server.
   * Talks to API via HTTPS.

2. **Backend API (Node.js/TypeScript, FastAPI, or similar)**

   * REST/JSON endpoints:

     * `/templates` (CRUD).
     * `/batches` (create from Excel/text, list, details).
     * `/batches/{id}/generate`.
     * `/fonts` (upload/list).
     * `/files/sign-url` (if you need pre-signed SeaweedFS URLs).
   * Integrates with:

     * SeaweedFS (HTTP or gRPC).
     * Database (PostgreSQL or similar).
     * Queue worker for heavy jobs.

3. **Rendering worker**

   * Separate process/service subscribed to job queue.
   * Picks jobs, renders cards, uploads to SeaweedFS.
   * Sends progress updates (possible future WebSocket events).

4. **Database**

   * Tables:

     * `users` (reference to central Id).
     * `templates` (JSON definition).
     * `fonts` (metadata, SeaweedFS path).
     * `batches` (metadata, template ref).
     * `batch_records` (parsed data, mapping status).
     * `generation_jobs` (status, output paths).
     * `usage_counters` (cards per user per period).

5. **SeaweedFS**

   * Buckets/collections:

     * `/templates/backgrounds`.
     * `/fonts`.
     * `/batches/outputs`.
   * Store only references in DB.

6. **Central auth/subscription app**

   * Already exists.
   * Exposes:

     * SSO redirect to e-card app.
     * WebSocket endpoint for subscription events.
     * REST endpoint if needed for on-demand checks.

---

## 6. Claude Code–oriented implementation plan

Here’s a breakdown you can literally turn into tasks/prompts for Claude Code.

### Phase 1 – Skeleton & integration

1. **Repo setup**

   * Monorepo (e.g. pnpm or turbo) or two repos: `ecard-frontend`, `ecard-backend`.
   * Dockerfiles + docker-compose for local dev (SeaweedFS, Postgres, Redis, backend, frontend).
2. **Auth glue**

   * Implement SSO callback route in frontend.
   * Parse JWT, store in global state.
   * Implement WebSocket client that connects to central app (mock server during dev).

**Claude prompt example:**

> “Create a minimal Node/TS Express API with endpoints `/health` and `/me` that reads user info from a JWT in the Authorization header. Include Dockerfile and docker-compose service def.”

### Phase 2 – Template editor

3. **Canvas editor**

   * Stage/Layer with background image.
   * Add/drag/resize text and QR placeholders.
   * Store template JSON in state.
4. **Template CRUD**

   * API + DB models.
   * Save/Load templates.

**Claude prompt idea:**

> “Implement a React component `TemplateEditor` using Konva where the user can add draggable text and QR rectangles over an uploaded background image. Use a `Template` JSON schema and emit changes via `onChange`.”

### Phase 3 – File upload & parsing

5. **Excel upload endpoint**

   * Accept `.xlsx`.
   * Parse rows with `xlsx` lib.
   * Produce normalized table.
6. **Text paste parser**

   * Implement heuristics described above.
7. **Field mapping logic**

   * Non-LLM classification.
   * Integrate optional LLM call.

**Claude prompt idea:**

> “Given a headers array and sample rows, write a TypeScript function that returns the most likely mapping to canonical fields (`name`, `position`, `email`, `phone`, `extension`) using regex and fuzzy matching. Provide unit tests.”

### Phase 4 – Batch management UI

8. **Batch CRUD**

   * List, detail view.
   * Mapping UI (drag/drop or select mapping dropdowns).
9. **Phone/extension rules**

   * Config on template or per user (store `phone_prefix`, `extension_length`).
   * Implement logic and tests.

### Phase 5 – Rendering and export

10. **Rendering worker**

    * Implement job queue: create job per batch.
    * Render single card from template + record data.
11. **SeaweedFS integration**

    * Simple client to upload and get public/secured URL.
12. **Download endpoints**

    * List output files per batch.
    * Zip/PDF packaging.

### Phase 6 – Subscription & limits

13. **WebSocket handling**

    * Listen for subscription updates.
    * Update usage bar and disable actions accordingly.
14. **Server-side enforcement**

    * Middleware to check counters.
    * Update counters after successful generation.

### Phase 7 – Polish & hardening

15. **Error handling & UX**

    * Show parsing errors and allow record-level edits.
16. **Logging & monitoring**

    * Structured logging for batch failures, parsing issues, LLM errors.
17. **Permissions & multi-tenant**

    * Ensure user can only access their own templates/batches.

---

If you want, next step I can:

* Propose a concrete **data model (Postgres schema)**, or
* Draft the **Template JSON schema** and **BatchRecord schema**, so you can paste them straight into Claude Code and start generating actual TypeScript models and API handlers.
