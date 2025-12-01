Yes — that JSX template adds a few **very specific behaviors** we should preserve in the web version. I’ll fold those into a **fully rewritten scope document** (staged for Codex / Claude Code), and then give you an updated **starting context** you can paste at the beginning of any session.

* * *

E-Card / QR-Code Designer – Full Scope (v2, with JSX details)
=============================================================

0. Legacy behavior to preserve

------------------------------

From the C# + InDesign system and `GenerateCardsBvars.jsx`:

1. **Record object passed to InDesign (`[record]`)**  
   The script expects a `record` with fields like:
   
   * `Name`, `LastName`, `Position`
   
   * `Texto1`, `Texto2`, `Texto3`
   
   * `PhoneX`, `PhoneY`, `PhoneShow`
   
   * `WhaX`, `WhaY`, `WhatsappShow`
   
   * `WebX`, `WebY`, `WebShow`
   
   * `InY`, `FileName`, etc.  
     These are produced on the C# side (`Staff`, `StaffDet`, `Tools.CalculateLayout`).

2. **Named InDesign objects**  
   Script targets specific items by name:
   
   * Text frames: `"Nombre"`, `"Cargo"`, `"Texto1"`, `"Texto2"`, `"Texto3"`.
   
   * Image items: `"In"`, `"Phone"`, `"Whatsapp"`, `"Web"`.

3. **Brand colors & per-word styling**
   
   * Color `"CodeBlueCMYK"` (created if missing), plus `"Black"`.
   
   * Name frame content: `record.Name + " " + record.LastName`.
   
   * Characters `0 .. record.Name.length-1` are **blue** (first name).
   
   * Remaining characters are **black** (rest of full name).

4. **Auto-fit text to frame (single line)**
   
   * Functions `fitTextInFrame(textFrame, maxSize)` and `getTextRightEdge(textFrame)`:
     
     * Ensure **no overflow**.
     
     * Decrease font size in small steps down to a `minSize` (4pt) until it fits.
     
     * Cap at `maxSize` (18pt for name, 11.03pt for position).
     
     * Ensures **single line** fit.

5. **Dynamic positioning of “In” icon**
   
   * Computes `nameFrameEndX` and `positionFrameEndX` using `getTextRightEdge`.
   
   * `InXLimit = max(nameFrameEndX, positionFrameEndX) + 4`.
   
   * Clamped to `[487.8415, 506.91]`.
   
   * Moves item `"In"` to `[InXLimit, record.InY]`.
   
   * Currently `inImage.visible = false`, but behavior exists.

6. **Dynamic positioning & visibility of contact icons**
   
   * Moves `"Phone"`, `"Whatsapp"`, `"Web"` items to:
     
     * `[record.PhoneX, record.PhoneY]`
     
     * `[record.WhaX, record.WhaY]`
     
     * `[record.WebX, record.WebY]`
   
   * Sets `visible` from `record.PhoneShow`, `record.WhatsappShow`, `record.WebShow`.

7. **Export behavior**
   
   * Exports **page 1** to PNG (and optionally JPG) with:
     
     * `exportResolution = 144`
     
     * `pngQuality = MAXIMUM`
     
     * `antiAlias = true`
     
     * `useDocumentBleeds = false`.

The web version should **functionally reproduce** these behaviors in a template-driven way.

* * *

1. System Overview

------------------

**Goal:**  
Browser-based designer that lets users create card templates and batch-generate personalized e-cards/QRs, while:

* Preserving existing **layout logic** (Texto1/2/3, icons, etc.).

* Providing **batch import** from Excel and loose text.

* Integrating with:
  
  * **Central auth + subscription** webapp (SSO + WebSocket).
  
  * **SeaweedFS** for background images, fonts, and outputs.

**Key points from user requirements:**

* Batch creation (Excel or text paste).

* Robust, “loose” parsing (possibly LLM-assisted).

* Upload template PNG, custom fonts.

* Color control; first word one color, rest another.

* Save template layouts.

* Subscription & rate limit integration via WebSocket.

* Phone vs extension inference (extension = 4 digits suffix of a prefix).

* Per-user storage on SeaweedFS.

* * *

2. Core Domain Models (with JSX details)

----------------------------------------

### 2.1 Canonical staff record

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
      web?: string;             // default www.codedg.com
      fileSlug: string;         // GetEmailClean()
      fileNameKey: string;      // GetEmailClean() + "_" + hash
      layout: StaffLayout;      // from CalculateLayout
      extra?: Record<string, string>;
    };

### 2.2 Layout / StaffDet

Port from `StaffDet` + `Tools.CalculateLayout`:
    type StaffLayout = {
      // text layout
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

This layout information must be enough to reconstruct the `record` object used by the JSX script.

### 2.3 Template JSON (extended to match JSX)

We extend the earlier template model with:

* **Auto-fit configuration** (min/max font size, singleLine).

* **Image elements** for icons and “In”.

* **Dynamic positioning hooks**.

    type AutoFitConfig = {
      enabled: boolean;
      minSize: number;      // e.g. 4
      maxSize: number;      // e.g. 18 or 11.03
      singleLine: boolean;  // mimic InDesign behavior
    };
    
    type TextStyleRule =
      | { type: "firstWord"; color: string }
      | { type: "rest"; color: string };
    
    type TextElement = {
      id: string;
      kind: "text";
      name: string;                 // e.g. "Nombre", "Cargo", "Texto1"
      field: string;                // e.g. "fullName", "position", "texto1"
      x: number;
      y: number;
      maxWidth?: number;
      fontFamily: string;
      fontSize: number;             // initial
      color: string;
      align?: "left" | "center" | "right";
      autoFit?: AutoFitConfig;      // from JSX fitTextInFrame logic
      styleRules?: TextStyleRule[]; // first word vs rest
    };
    
    type ImageElement = {
      id: string;
      kind: "image";
      name: string;                 // e.g. "Phone", "Whatsapp", "Web", "In"
      assetUrl: string;             // SeaweedFS icon
      x: number;
      y: number;
      visibleByDefault: boolean;
      visibilityField?: string;     // e.g. "phoneShow"
      dynamicXField?: string;       // e.g. "phoneX"
      dynamicYField?: string;       // e.g. "phoneY"
    };
    
    type QRCodeElement = {
      id: string;
      kind: "qr";
      name: string;
      field: string;                // "qrData"
      x: number;
      y: number;
      size: number;
      colorDark: string;
      colorLight: string;
    };
    
    type TemplateElement = TextElement | ImageElement | QRCodeElement;
    
    type Template = {
      id: string;
      userId: string;
      name: string;
      backgroundUrl: string;
      width: number;
      height: number;
      elements: TemplateElement[];
      phonePrefix?: string;
      extensionLength?: number;
      exportDpi?: number;           // default 300 (even if legacy used 144)
      createdAt: Date;
      updatedAt: Date;
    };

**Key JSX-driven behaviors to preserve:**

* Name text element:
  
  * Uses `styleRules` for first word (CodeBlue) vs rest (black).
  
  * Auto-fit with maxSize=18, minSize=4, singleLine.

* Position text element:
  
  * Auto-fit with maxSize≈11.03, minSize=4, singleLine.

* “In” image:
  
  * X position computed as:
    
    * `max(rightEdge(name), rightEdge(position)) + margin`
    
    * Clamped between `minInX` and `maxInX` (template config).

* Phone/WhatsApp/Web icons:
  
  * Visibility bound to layout booleans.
  
  * Position bound to layout X/Y fields.

* * *

3. Functional Requirements

--------------------------

### 3.1 Auth & subscriptions

As in previous scope (unchanged, summarizing):

* Auth handled by central webapp.

* E-card app receives JWT; uses it to identify user.

* WebSocket connection to central app:
  
  * Subscription tier & rate limits.
  
  * Live updates on limit changes, suspensions, etc.

* Server-side enforcement of:
  
  * Max number of cards per month.
  
  * Max batch size & concurrency.

### 3.2 Template designer (with JSX features)

User capabilities:

* Upload background PNG.

* Add elements:
  
  * Text fields:
    
    * Link to data fields: `Name`, `LastName`, `fullName`, `Position`, `Texto1`, `Texto2`, `Texto3`, etc.
    
    * Set base font, color, alignment.
    
    * Configure **auto-fit**:
      
      * `minSize`, `maxSize`, single-line.
      
      * This must approximate `fitTextInFrame`.
    
    * Configure **per-word styling**:
      
      * “First word color X; rest color Y” (for Name).
  
  * Icons (image elements):
    
    * e.g. phone, WhatsApp, web, “In”.
    
    * Map their `visibilityField` & `dynamicXField/YField` to layout fields:
      
      * `phoneShow`, `phoneX`, `phoneY`, etc.
  
  * QR code elements.

* Configure **In icon dynamic behavior**:
  
  * Template stores:
    
    * `inMarginX` (4 pt).
    
    * `inXMin`, `inXMax` (487.84, 506.91 equivalents).
  
  * Rendering engine uses:
    
    * `InX = clamp(max(nameRightEdge, positionRightEdge) + inMarginX, inXMin, inXMax)`.

### 3.3 Fonts & colors

* Built-in palette includes “CodeBlue” and black; user can add more.

* Custom font upload (TTF/OTF) stored per user.

* Renderer can load fonts at runtime for server-side rendering.

### 3.4 Data import (Excel & text)

Same as previous scope, but **explicitly**:

* Excel import:
  
  * Recreates `StaffReader` logic.
  
  * Port C# functions:
    
    * `ValidateString`, `ParseName`, `ToTitleCaseCorrect`, `FormatCostaRicanPhoneNumber`.
    
    * `CalculateLayout` (to produce layout fields used in JSX).

* Text import:
  
  * Heuristics for Spanish headers and column grouping.
  
  * Builds CanonicalStaff + StaffLayout identical in spirit to Excel path.

### 3.5 Phone vs extension

* Config fields:
  
  * `phonePrefix` per template/user (e.g. `"2459-"`).
  
  * `extensionLength=4` by default.

* Logic:
  
  * If raw input is 4 digits → treat as extension; phone = prefix + extension.
  
  * If raw input contains prefix + 4 digits → treat as phone (extension maybe absent).
  
  * If raw input like `"2459-7584 / 1234"`:
    
    * Split on `/;|,`.
    
    * Part with prefix = phone; 4-digit part = extension.

### 3.6 Batch management & preview

Same as before:

* List batches per user.

* Batch detail view with records.

* Per-record preview using client-side canvas, applying:
  
  * Auto-fit text logic.
  
  * Per-word colors.
  
  * Icon visibility via layout flags.
  
  * In icon positioning behavior.

### 3.7 Rendering & export (JSX-equivalent engine)

Worker responsibilities:

1. **Load template & staff record**.

2. **Create a canvas** (node-canvas or headless Chromium):
   
   * Set size `width x height`.
   
   * Draw background PNG.
   
   * For each **text element**:
     
     * Resolve content from `CanonicalStaff` + `StaffLayout`.
     
     * If `styleRules` includes firstWord/rest:
       
       * Split string; draw segments with different colors.
     
     * Apply **auto-fit**:
       
       * Start at `maxSize`.
       
       * Measure text width; if > maxWidth or multi-line, reduce toward `minSize`.
       
       * Mirror `fitTextInFrame` semantics as closely as possible.
   
   * Compute **right edge** of name and position:
     
     * Equivalent to `getTextRightEdge`; can use text metrics and bounding boxes.
   
   * For **In** image element:
     
     * Compute `InX` = clamped max(rightEdge(name), rightEdge(position)) + margin.
     
     * Position accordingly.
     
     * Allow template or user to toggle visibility (even if hidden by default).
   
   * For **Phone/WhatsApp/Web** icons:
     
     * Use `layout.phoneShow` etc to set `visible`.
     
     * Place at `layout.phoneX/Y`, etc.
   
   * For **QR** element:
     
     * Generate QR image; draw at given x,y with size and colors.

3. **Export**:
   
   * PNG (default) and optionally JPG.
   
   * `exportDpi` taken from template (default 300; can be set to 144 to match legacy).

4. **Store**:
   
   * Upload to SeaweedFS: `/users/{userId}/batches/{batchId}/{recordId}.png`.
   
   * Update job and batch status.

* * *

4. Non-functional & infrastructure (unchanged essence)

------------------------------------------------------

* Docker-based dev stack (backend, frontend, Redis, Postgres, SeaweedFS).

* Horizontal scalability.

* Logging and monitoring.

* Rate-limiting and multi-tenant isolation.

* * *

5. Implementation Stages (Codex / Claude-friendly)

--------------------------------------------------

Same rough stages, but explicitly include JSX aspects.

### Stage 1 – Skeleton & Auth

* Create repos, Docker, JWT middleware, basic frontend shell.

### Stage 2 – DB & domain models

* Implement schema & TS types (`Template`, `Batch`, `CanonicalStaff`, `StaffLayout`, `RenderJob`).

### Stage 3 – Port C# parsing & layout logic

* Port:
  
  * `ValidateString`, `ParseName`, `ToTitleCaseCorrect`, `GetEmailClean`, `CalculateLayout`, etc.

* Implement Excel & text import endpoints.

* Output `CanonicalStaff` + `StaffLayout` that can be serialized into `record` equivalent.

### Stage 4 – Template designer (with auto-fit & dynamic elements)

* Implement canvas editor.

* Support text, icons, and QR elements.

* For text elements, configure auto-fit and style rules (firstWord/rest)

* For icons, configure dynamic positions and visibility fields.

### Stage 5 – Batch management UI

* “New batch” wizard, mapping UI, batch list & detail, per-record preview.

### Stage 6 – Rendering worker (JSX-equivalent behavior)

* Implement node-canvas/headless renderer.

* Implement auto-fit and right-edge calculations.

* Implement “In” icon alignment logic and icon visibility.

* Implement PNG/JPG export and SeaweedFS upload.

* Implement endpoints to start generation and download outputs.

### Stage 7 – Subscription limits & polish

* WebSocket subscription integration, usage counters, UX polish, error handling.

* * *

Updated Starting Context for Codex / Claude Code
================================================

You can paste this at the top of any session:

* * *

**PROJECT CONTEXT – E-Card / QR-Code Designer**

We are building a **web-based e-card / QR-code designer**, replacing a legacy **C# WPF + Adobe InDesign** pipeline.

### Legacy behavior

* C# code (`StaffReader.cs`, `Staff.cs`, `StaffDet.cs`, `Tools.cs`, `NameParser.cs`) reads an Excel with staff, validates names, parses first/last name, computes layout (`StaffDet`), and builds a `record` object.

* A JSX script `GenerateCardsBvars.jsx` runs inside InDesign:
  
  * Receives `record` plus `[idPath]` (template INDD path) and `[exportPath]`.
  
  * Opens template document.
  
  * Looks up items by name:
    
    * Text frames: `"Nombre"`, `"Cargo"`, `"Texto1"`, `"Texto2"`, `"Texto3"`.
    
    * Images: `"In"`, `"Phone"`, `"Whatsapp"`, `"Web"`.
  
  * Sets text:
    
    * `Nombre` frame contents = `record.Name + " " + record.LastName`.
    
    * Characters `0..record.Name.length-1` colored CodeBlue, rest black.
    
    * `Cargo` frame contents = `record.Position`.
    
    * `Texto1/2/3` from layout.
  
  * Calls `fitTextInFrame(textFrame, maxSize)` to auto-shrink font:
    
    * minSize=4, maxSize=18 for name, ~11.03 for position.
    
    * Ensures text fits in a single line (no overflow).
  
  * Computes right edges of name and position frames via `getTextRightEdge`.
  
  * Computes `InXLimit = clamp(max(nameRight, positionRight) + 4, 487.84, 506.91)`.
  
  * Moves `"In"` image to `[InXLimit, record.InY]` and hides it (`visible = false`).
  
  * Moves `"Phone"`, `"Whatsapp"`, `"Web"` images to layout-derived coordinates:
    
    * `[record.PhoneX, record.PhoneY]`, `[record.WhaX, record.WhaY]`, `[record.WebX, record.WebY]`.
  
  * Sets `visible` on those icons based on `record.PhoneShow`, `record.WhatsappShow`, `record.WebShow`.
  
  * Exports page 1 to PNG (resolution 144, MAXIMUM quality, antiAlias=true).

Our new system must **preserve these semantics** but:

* Use a **Template JSON** (background PNG + elements).

* Use a **Node.js renderer** (node-canvas or headless browser) instead of InDesign.

* Use **SeaweedFS** instead of local export folders.

### New architecture

* **Frontend:** React/Next.js SPA with:
  
  * Template designer (canvas).
  
  * Batch import wizard (Excel or text).
  
  * Batch list & preview.

* **Backend API:** Node.js + TypeScript.

* **Worker:** Node-based renderer for card images.

* **DB:** PostgreSQL (templates, batches, records, jobs, usage).

* **Queue:** Redis + BullMQ (render jobs).

* **Storage:** SeaweedFS (templates, fonts, outputs).

* **Auth/Subs:** Central webapp → JWT + WebSocket (subscription + rate limits).

### Template / rendering semantics

* Template JSON must support:
  
  * Text elements with:
    
    * Data field bindings (Name, LastName, Position, Texto1/2/3).
    
    * Auto-fit config (`minSize`, `maxSize`, `singleLine`).
    
    * Per-word styling rules (firstWord vs rest color).
  
  * Image elements for icons:
    
    * `"Phone"`, `"Whatsapp"`, `"Web"`, `"In"`.
    
    * Visibility controlled by layout fields.
    
    * Optional dynamic X/Y based on layout fields.
  
  * QR code elements (with configurable colors).

* Renderer must:
  
  * Apply **C# parsing/layout logic** (ported versions of `NameParser`, `Tools.CalculateLayout`, etc.).
  
  * Auto-fit text similar to `fitTextInFrame`.
  
  * Compute right edges and position “In” icon as in JSX.
  
  * Respect template export DPI (default 300, but we can configure 144).

### Phone vs extension

* We must distinguish between phone and extension:
  
  * Extension usually 4 digits and suffix of a configurable prefix (e.g. `2459-`).
  
  * 4-digit-only values → extension, phone = prefix + extension.
  
  * Combined strings like `2459-7584 / 1234` → phone and extension split.

### How you should help

When I ask for code or designs:

* Port C# helpers (`NameParser`, `Tools`, etc.) into TypeScript with equivalent behavior.

* Implement template designer and renderer respecting:
  
  * Auto-fit,
  
  * Per-word colors,
  
  * Icon visibility/position,
  
  * Phone vs extension rules.

* Favor modular, production-ready code (clear services, DTOs, tests).

* * *

If you want, next step we can take **Stage 3 (C# → TS parsing & layout)** and write the exact TS function signatures + Jest tests, ready to paste into your repo.
