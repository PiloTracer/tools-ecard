Here’s a clean, self-contained **Markdown scope document** plus a **reusable “starting context”** you can paste into Codex / Claude Code at the beginning of any session.

---

# E-Card / QR-Code Designer – Full Project Scope

## 0. Legacy Reference (Current C# / InDesign App)

The existing WPF + InDesign solution has these key behaviors:

* Reads staff data from an **Excel** sheet (`StaffReader` using EPPlus).

  * Starts at a fixed row / column.
  * Columns include: full name, email, WhatsApp, position, phone.
  * Uses `NameParser.ParseName(fullName)`:

    * 4+ parts → `LastName = part0 + " " + part1`, `FirstName = rest`.
    * 2 parts → `LastName = part0`, `FirstName = part1`.
    * 1 part → `FirstName = fullName`, `LastName = ""`.
  * Validates full name with `Tools.ValidateString`:

    * Trimmed length ≥ 5 and at least 2 words.
* Builds a `Staff` object:

  * `Name`, `LastName`, `Position`, `Email`, `Tel`, `Wha`, `Web`.
  * `Details = Tools.CalculateLayout(fullName, pos, tel, wha, web)`.
  * `GetEmailClean()` → normalized lower-case email, non `[a-z0-9]` replaced with `_`.
  * `GetFileName()` → `GetEmailClean() + "_" + short hash of combined fields`.
* `Tools.CalculateLayout(...)`:

  * Produces `StaffDet`:

    * Default visual settings: `NameSize`, `CargoSize`, `InX`.
    * Phone, WhatsApp, web **X/Y coordinates**.
    * **Show/hide flags**: `PhoneShow`, `WhatsappShow`, `WebShow`.
    * `Texto1/2/3` used to decide which lines appear and where, based on what contact info exists.
* `StaffReader.GenerateJavaScriptDataStringForSingleStaff(staff)`:

  * Generates a `var record = { ... }` JS object with all fields.
* `MainWindow`:

  * Reads Excel.
  * For each staff:

    * Reads a JSX script template from disk.
    * Replaces `[idPath]`, `[exportPath]`, `[record]` placeholders.
    * Sends the JS to **InDesign** via COM for rendering and export (PNG / JPG).
  * Ensures export folders exist via `Tools.EnsureExportDirectoriesExist`.

**New app must preserve:**

* Name parsing rules.
* Validation logic for skipping invalid rows.
* Layout decision logic (what shows where) from `CalculateLayout`.
* File naming strategy (`GetEmailClean` + hash).
* Per-record **record object** that is used to drive card generation.

The difference: instead of InDesign + JSX, we’ll use a **web template JSON + rendering worker**.

---

## 1. High-Level System Overview

**Goal:**
Browser-based designer “like InDesign” that:

* Lets users define **card templates** (background + positioned text/QR elements, font/color rules).
* Allows **batch creation** of cards / QR codes from:

  * Excel files.
  * Pasted text blocks.
* Integrates with:

  * Central **auth + subscription** webapp (SSO + WebSocket for limits).
  * **SeaweedFS** for storing templates, custom fonts, and output cards.
* Implements **phone vs extension** rules:

  * Extension usually 4 digits, suffix of a configurable prefix (e.g. `2459-`).
  * System infers phone + extension from user data.

### 1.1 Target Tech Stack (suggested)

* **Frontend:** React or Next.js SPA
* **Backend API:** Node.js + TypeScript (Express/Fastify) or similar
* **Rendering worker:** Node + `node-canvas` / headless Chromium
* **DB:** PostgreSQL
* **Queue:** Redis + BullMQ (for batch jobs)
* **Storage:** SeaweedFS
* **Auth:** JWT/SSO from central app + WebSocket for subscription updates

---

## 2. Core Domain Models

### 2.1 Canonical Person / Staff Record

```ts
type CanonicalStaff = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  telRaw?: string;
  phone?: string;
  extension?: string;
  whatsapp?: string;
  web?: string;          // default www.codedg.com
  fileSlug: string;      // GetEmailClean()
  fileNameKey: string;   // GetEmailClean() + "_" + hash
  layout: StaffLayout;   // ported from StaffDet / CalculateLayout
  extra?: Record<string, string>;
};
```

### 2.2 Layout / StaffDet (ported)

```ts
type StaffLayout = {
  nameSize: number;
  cargoSize: number;
  inX: number;
  inY: number;
  phoneX: number;
  phoneY: number;
  phoneShow: boolean;
  whaX: number;
  whaY: number;
  whatsappShow: boolean;
  webX: number;
  webY: number;
  webShow: boolean;
  texto1: string;
  texto2: string;
  texto3: string;
};
```

Default values & conditions should mimic `Tools.CalculateLayout` (including all the positioning/visibility decisions based on tel/wha/web presence).

### 2.3 Template JSON

A **template** replaces the INDD file + custom layers:

```ts
type TemplateElement =
  | {
      id: string;
      kind: "text";
      field: string;            // "name", "position", "texto1", etc.
      x: number;
      y: number;
      maxWidth?: number;
      fontFamily: string;
      fontSize: number;
      color: string;
      align?: "left" | "center" | "right";
      styleRules?: TextStyleRule[];
    }
  | {
      id: string;
      kind: "qr";
      field: string;            // e.g. "qrData"
      x: number;
      y: number;
      size: number;
      colorDark: string;
      colorLight: string;
    };

type TextStyleRule =
  | { type: "firstWord"; color: string }
  | { type: "rest"; color: string };

type Template = {
  id: string;
  userId: string;
  name: string;
  backgroundUrl: string;   // SeaweedFS
  width: number;
  height: number;
  elements: TemplateElement[];
  phonePrefix?: string;    // used by phone/extension logic
  extensionLength?: number;
  createdAt: Date;
  updatedAt: Date;
};
```

### 2.4 Batch & Jobs

```ts
type Batch = {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  sourceType: "excel" | "text";
  sourceFileUrl?: string;
  rowCount: number;
  status: "draft" | "processing" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
};

type BatchRecord = {
  id: string;
  batchId: string;
  rowIndex: number;
  data: CanonicalStaff;
};

type RenderJob = {
  id: string;
  batchId: string;
  recordId: string;
  templateId: string;
  outputFormat: "png" | "jpg" | "pdf_page";
  outputPath: string;    // SeaweedFS path
};
```

---

## 3. Functional Requirements

### 3.1 Authentication & Subscriptions

* Users authenticate in the **central webapp**.
* When user selects “E-Card / QR-Code Designer”:

  * They are redirected with an SSO/JWT token.
* E-card front-end:

  * Validates token.
  * Stores `userId`, `subscriptionTier`, etc.
  * Opens a **WebSocket** to central app to receive:

    * `subscription_updated`
    * `rate_limit_updated`
    * `account_suspended`, etc.
* Backend:

  * Validates JWT on each request.
  * Enforces **rate limits** on batch creation and card rendering.

### 3.2 Template Designer

* Upload **PNG** background.

  * Stored in SeaweedFS.
* Add/edit/remove elements:

  * Text fields (mapped to logical fields like `Name`, `Position`, `Texto1`, `Texto2`, `Texto3`).
  * QR placeholder.
* Controls:

  * Font family (select from built-in fonts or user-uploaded fonts).
  * Font size, weight.
  * Colors.
  * Alignment.
  * `styleRules` such as:

    * First word color = X, rest = Y.
* Snap-to-grid, zoom, simple layer list.
* Save template:

  * Template JSON as above.
  * Reference to SeaweedFS path for background.

### 3.3 Font Handling

* Default font library.
* User can upload **TTF/OTF**:

  * File stored in SeaweedFS under `/users/{userId}/fonts/...`.
  * Recorded in DB; associated with templates.
  * Renderer loads custom fonts when generating images.

### 3.4 Data Import – Excel

* Accept `.xlsx` (later `.csv` if desired).
* Detect worksheet and header row (default row/col, but configurable).
* For each row:

  * Extract:

    * Full name, email, WhatsApp, position, phone, etc.
  * Validate row using `ValidateString(fullName)` semantics:

    * Trim; length ≥ 5; at least 2 words.
  * Apply `NameParser` logic:

    * 2 parts → first/last.
    * 3+ parts → first two as `LastName`, rest as `FirstName`.
  * Use `Tools.ToTitleCaseCorrect` behavior for names (title-case using invariant culture but preserve known behavior).
  * Build CanonicalStaff.
  * Call `CalculateLayout` port to get `layout`.
  * Set `fileSlug = GetEmailClean()` and `fileNameKey` as in original.
* Insert rows into `BatchRecord`.

### 3.5 Data Import – Pasted Text

* User can paste a block like:

  ```
  Nombre

  Puesto

  Correo

  Numero de teléfono

  Valeria Arias Gonzalez

  Asistente Administrativa

  varias@code-cr.com

  2459-7584

  Leyner Jimenes Carranza

  Project Engineer

  ljimenezca@code-cr.com

  2459-7579
  ```

* Parser pipeline:

  1. Strip leading/trailing whitespace.
  2. Split by blank lines.
  3. Detect header block (first 3–6 lines that look like labels).
  4. Map labels to canonical fields using simple heuristics:

     * Contains “Nombre” → name.
     * Contains “Puesto” → position.
     * Contains “Correo” → email.
     * Contains “Teléfono” → phone.
  5. Group remaining lines as repeating sets of fields in header order.
  6. Use same validation, name parsing, layout calculation as Excel path.

* Provide **field mapping screen**:

  * Show detected columns and recommended mapping.
  * Allow user to change mapping before saving batch.

* Optional: LLM assist for header mapping (GPT-mini / Claude):

  * Only for low-confidence cases; must return constrained JSON mapping.

### 3.6 Phone vs Extension Logic

* System config per tenant/template:

  * `phonePrefix` (e.g. `"2459-"` or `"+(506) 2459-"`).
  * `extensionLength` (default 4).
* Rules:

  * If field is exactly 4 digits → treat as `extension`; build full phone as `prefix + extension`.
  * If field contains prefix followed by 4 digits (e.g. `2459-7584`), treat as full phone; `extension` optional.
  * If compound string like `2459-7584 / 1234`:

    * Split by `/`, `;`, commas.
    * Part starting with prefix = `phone`.
    * 4-digit chunk = `extension`.
* Stored in CanonicalStaff:

  * `telRaw` (original).
  * `phone`, `extension`.
* Layout (`CalculateLayout` port) may still look at tel/wha/web presence to determine `texto1/2/3`.

### 3.7 Batch Management & Preview

* **Batch list** per user:

  * Name, template, createdAt, rowCount, status.
* Batch details:

  * Paginated table of records:

    * Full name, email, position, phone, extension, etc.
    * Quick search.
  * Preview:

    * Click a row → render preview of card using template and data (in browser).
* Batch actions:

  * Generate cards (PNG or JPG).
  * Re-generate after changing template.
  * Download:

    * Zip with individual PNG/JPGs.
    * Optional multi-page PDF.

### 3.8 Rendering & Export

* Rendering worker reads `RenderJob`s from queue.
* For each job:

  1. Load template JSON.
  2. Load background image from SeaweedFS.
  3. Load fonts (system + user fonts).
  4. Draw:

     * Name / last name / position.
     * `Texto1/2/3` lines as defined by `StaffLayout`.
     * icons/labels (phone, WhatsApp, web), if part of template.
     * QR code (if used) with template colors.
     * Apply **first word vs rest** color rules.
  5. Export to PNG/JPG (typical business card resolution, e.g. 1076×384 or similar).
  6. Upload to SeaweedFS under `/users/{userId}/batches/{batchId}/{recordId}.png`.
* Worker sends job status updates (optional) to backend / WebSocket.

---

## 4. Non-Functional Requirements

* **Performance**

  * 200-person batch should complete within ~1 minute on typical server hardware.
* **Scalability**

  * Stateless API; horizontally scalable.
  * Rendering jobs processed via queue; can scale worker count.
* **Security**

  * All endpoints require JWT; no cross-tenant data leaks.
  * SeaweedFS paths must not be guessable (use hashed file names).
  * Rate limiting per subscription.
* **Reliability**

  * If worker crashes mid-batch, jobs can be retried.
  * Batch status can be `partial` with count of successes/failures.
* **Auditability**

  * Log key events:

    * Batch imports.
    * Mapping choices.
    * Subscription limit errors.
    * Rendering errors.

---

## 5. Implementation Stages (For Codex / Claude Code)

### Stage 1 – Project Skeleton & Auth

**Goal:** Have a running backend + frontend with basic auth handshake.

* Set up monorepo or separate repos:

  * `ecard-backend` (Node/TS)
  * `ecard-frontend` (React/Next).
* Backend:

  * Express/Fastify server, `/health` endpoint.
  * JWT middleware for `Authorization: Bearer`.
* Frontend:

  * Simple app that:

    * Reads JWT from URL query/#fragment.
    * Stores user info in global state.
* Docker:

  * `docker-compose` with backend, frontend, Postgres, Redis, SeaweedFS (basic config).

**Acceptance:**

* Can run `docker-compose up` and open frontend → see “Hello {userId}”.

---

### Stage 2 – Domain Models & DB Schema

**Goal:** All main data tables exist and migrations are in place.

* Define TypeScript models:

  * `Template`, `Batch`, `BatchRecord`, `CanonicalStaff`, `StaffLayout`, `RenderJob`.
* Create DB migrations:

  * `users`, `templates`, `batches`, `batch_records`, `jobs`, `usage_counters`.
* Create basic repositories / ORM models (Prisma/TypeORM/Drizzle etc).

**Acceptance:**

* Can run migrations; backend unit tests can create & fetch sample records.

---

### Stage 3 – Parsing Services (Port from C#)

**Goal:** Replace the WPF Excel/parsing logic with backend services that behave compatibly.

* Implement:

  * `parseName(fullName)` per `NameParser.ParseName`.
  * `validateName(fullName)` per `Tools.ValidateString`.
  * `toTitleCaseCorrect(str)` per `Tools.ToTitleCaseCorrect`.
  * `calculateLayout(fullName, pos, tel, wha, web)` replicating `Tools.CalculateLayout` and `StaffDet`.
  * `getEmailClean(email)` and hash logic for filenames.
* Implement Excel import endpoint:

  * `/batches/import-excel`:

    * Save file (or stream).
    * Parse rows using `xlsx`.
    * Build `CanonicalStaff` for each valid row, applying above functions.
* Implement text import endpoint:

  * `/batches/import-text`.
  * Parser as described in 3.5.
* Store rows as `BatchRecord` JSON.

**Acceptance:**

* Given the same Excel used by WPF app, new backend yields essentially same list of people and layout attributes.
* Unit tests compare new functions against C# examples.

---

### Stage 4 – Template Designer Frontend & Template API

**Goal:** User can create & save a template schema.

* Backend:

  * `/templates` CRUD.
  * SeaweedFS integration for background image upload.
* Frontend:

  * Simple template editor:

    * Upload background PNG.
    * Place text fields (Name, Position, Texto1/2/3, etc.).
    * Place QR placeholder.
    * Adjust font and colors.
    * Save template.

**Acceptance:**

* User can design a basic “Code Development Group” card template and see it re-loaded from DB.

---

### Stage 5 – Batch Management UI

**Goal:** User can import data and see it in the app.

* Frontend:

  * “New batch” wizard:

    * Select template.
    * Upload Excel OR paste text.
    * Show mapping screen.
    * Persist batch.
  * Batch list view.
  * Batch detail table with simple preview (front-end render with Canvas for single record).

**Acceptance:**

* User can upload the staff Excel, save a batch, and preview individual cards.

---

### Stage 6 – Rendering Worker & Export

**Goal:** Full batch rendering.

* Implement worker service:

  * Uses BullMQ with Redis.
  * Subscribes to `render_card` jobs.
* Rendering:

  * Uses node-canvas or headless Chromium to render template + staff record.
  * Implements:

    * Name & last name text drawing.
    * Layout logic for Texto1/2/3 as per `StaffLayout`.
    * First-word vs rest-color rules.
    * QR generation using template colors.
* Export:

  * Upload PNG/JPG to SeaweedFS.
  * Update `RenderJob` and `Batch` status.
* Backend:

  * `/batches/:id/generate` endpoint schedules jobs.
  * `/batches/:id/outputs` returns list of URLs.
  * `/batches/:id/download-zip` builds and streams a zip.

**Acceptance:**

* Batch of ~50 staff generates PNGs in SeaweedFS; they look visually consistent with legacy InDesign output (within reasonable tolerance).

---

### Stage 7 – Subscription Integration & Polishing

**Goal:** Production-ready UX with limits & feedback.

* WebSocket client in frontend:

  * Listens for subscription & limit updates.
* Usage tracking:

  * Increment counters when jobs complete.
  * Deny new batch generation when limits exceeded.
* UX polish:

  * Progress bar for batch rendering.
  * Error handling for bad rows.
  * Tooltips / help for phone vs extension rules.
* Hardening:

  * Logging & monitoring.
  * Improved validation for uploads.
  * Multi-tenant isolation tests.

**Acceptance:**

* Limits are enforced, and UI clearly informs user when they must upgrade subscription.

---

# Reusable Starting Context for Codex / Claude Code

You can paste this at the beginning of any session:

---

**PROJECT CONTEXT (Paste into every session)**

You are helping me build a **web-based e-card / QR-code designer**, similar to InDesign, with batch generation of business cards from Excel or pasted text.

### Legacy reference

We already have a **C# WPF + InDesign** solution with these files:

* `StaffReader.cs`: reads Excel staff file, builds `Staff` objects.
* `Staff.cs`: holds `Name`, `LastName`, `Position`, `Email`, `Tel`, `Wha`, `Web`, plus `GetEmailClean()` and `GetFileName()` which uses a hash.
* `StaffDet.cs`: layout parameters (`NameSize`, `CargoSize`, `InX`, `PhoneX`, `PhoneShow`, `WhatsappShow`, `WebShow`, `Texto1/2/3`, etc.).
* `Tools.cs`: helper functions:

  * `FormatCostaRicanPhoneNumber`,
  * `CalculateLayout(fullName, pos, tel, wha, web)` (decides what contact lines appear and where),
  * `ValidateString(fullName)` (skip invalid rows),
  * `ToTitleCaseCorrect(string)` (title-cases names),
  * `EnsureExportDirectoriesExist`,
  * `GetHash(string)` (normalized string → short hex hash).
* `NameParser.cs`: `ParseName(fullName)`:

  * 3+ parts → lastName = first two words, firstName = rest.
  * 2 parts → lastName = first word, firstName = second.
  * 1 part → firstName = full string.
* `MainWindow.xaml.cs`: reads staff Excel, calls `StaffReader`, builds a `var record = {...}` JS object for each staff, injects it into a JSX template, and sends the script to InDesign via COM to generate PNG/JPG cards.

The **new system must preserve the semantics** of these C# functions (name parsing, validation, layout decisions, file naming) but use a modern web stack instead of InDesign.

### New architecture

* **Frontend:** React/Next.js SPA with a canvas-based template designer.
* **Backend API:** Node.js + TypeScript (Express/Fastify).
* **Worker:** Node service for rendering cards using template JSON and staff data.
* **DB:** PostgreSQL for templates, batches, records, jobs, and usage tracking.
* **Queue:** Redis + BullMQ (render jobs).
* **Storage:** SeaweedFS for templates, fonts, generated card images.
* **Auth & subscriptions:**

  * Users authenticate via a separate central web app.
  * The e-card app receives a JWT and connects to a WebSocket on the central app to get live subscription & rate-limit updates.
* **Batch input:**

  * Excel files (similar structure to the existing app).
  * Pasted text blocks that contain headers such as `Nombre`, `Puesto`, `Correo`, `Número de teléfono`.

### Key constraints & rules

* Name parsing, validation, layout calculation, and file naming should be **ported from the C# code** into TypeScript with equivalent behavior.
* The system must **distinguish phone vs extension**:

  * Extension usually 4 digits and is the suffix of a configurable prefix (e.g. `2459-`).
  * If user enters 4 digits only → treat as extension and prepend prefix to get full phone.
  * Strings like `2459-7584 / 1234` should be split into `phone = 2459-7584`, `extension = 1234`.
* Template definitions:

  * Stored as JSON: background image URL, card size, and positioned elements (text/QR).
  * Text elements may include per-word style rules (e.g. “first word color X, rest color Y”).
* Batch generation:

  * For each `CanonicalStaff`, the worker combines:

    * Template JSON,
    * Staff layout (ported `StaffDet`),
    * `Texto1/2/3` decisions, and
    * Optional QR data
  * to render a PNG/JPG and store it in SeaweedFS.

### How to help

When I ask you for code:

* **Respect and reuse** the semantics of the original C# helpers (`NameParser`, `Tools`, `Staff`, `StaffDet`, `StaffReader`) but implement them in TypeScript for the Node.js backend or in frontend code where appropriate.
* Generate **modular, production-oriented code** with clear separation:

  * Parsing services,
  * Template CRUD,
  * Batch CRUD,
  * Rendering worker.
* When in doubt, assume:

  * Multi-tenant architecture (per-user isolation),
  * DB = PostgreSQL,
  * Storage = SeaweedFS,
  * Deployment under Docker.

---

If you want, next step I can break down **Stage 3 (parsing services)** into concrete function signatures & tests that you can directly feed into Codex / Claude Code.
