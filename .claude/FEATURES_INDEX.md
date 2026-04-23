# Features Index

Complete index of all documented features in the E-Cards project. Each feature has standardized documentation in `.claude/features/`.

## Quick Navigation

- [Core Features](#core-features) (includes authentication)
- [Batch Processing Features](#batch-processing-features)
- [Infrastructure Features](#infrastructure-features)
- [UI Features](#ui-features) (includes simple quick actions)
- [Workers](#12-render-worker)

---

## Core Features

### 1. Template Textile (Template Designer)
**Directory:** `.claude/features/template-textile/`

Visual card template editor with canvas-based design, text fields, images, QR codes, and background management.

- **Purpose:** Create and edit card templates for batch generation
- **Services:** front-cards, api-server
- **Key Files:**
  - `README.md` - Comprehensive feature documentation
  - `template-textile-core.md` - Core canvas functionality
  - `template-fonts.md` - Font management details
  - `template-batch.md` - Batch generation integration

**Use Cases:**
- Design card templates with visual editor
- Add/edit text fields with auto-fit
- Upload and manage background images
- Generate QR codes
- Export templates for batch rendering

---

### 2. Simple Projects
**Directory:** `.claude/features/simple-projects/`

Multi-project workspace management for organizing templates and batches into logical containers.

- **Purpose:** Project organization, workspace management
- **Services:** front-cards, api-server
- **Key Files:**
  - `README.md` - Business overview
  - `feature.yaml` - Service mapping

**Use Cases:**
- Auto-provision default project on first login
- Switch between projects
- Organize templates and batches by project
- Persist project selection across sessions

---

### 3. Authentication
**Directory:** `.claude/features/authentication/`

OAuth 2.0 with PKCE on the Next.js app (BFF route handlers under `app/api/auth/*`), client session via `AuthProvider`, and cookie-based user resolution on **api-server** (`authMiddleware`).

- **Purpose:** Sign-in, refresh, logout, and propagate identity to API calls
- **Services:** front-cards, api-server (middleware only)
- **Key Files:**
  - `README.md` — route and context map
  - `feature.yaml` — file paths and environment variables
  - `auto-auth.md` / `auto-auth.external.md` — long-form integration specs

**Use Cases:**
- Log in via organization OAuth
- Stay signed in with refresh where configured
- Call **api-server** with the same session cookie

---

## Batch Processing Features

### 4. Batch Upload
**Directory:** `.claude/features/batch-upload/`

File upload management for batch card generation with storage and async job queuing.

- **Purpose:** Upload contact files for batch processing
- **Services:** front-cards, api-server
- **Key Files:**
  - `README.md` - Upload workflows
  - `feature.yaml` - API endpoints

**Use Cases:**
- Upload .csv, .txt, .vcf, .xlsx files
- Track upload status and progress
- View upload history
- Retry failed uploads
- Delete uploaded batches

---

### 5. Batch Parsing
**Directory:** `.claude/features/batch-parsing/`

Background worker for parsing uploaded files (Python subprocess from Node) with optional LLM-assisted name parsing, plus **read/search** HTTP APIs on `/api/batch-records` and **diagnostics** on `/api/diagnostics/*`.

- **Purpose:** Parse files asynchronously into structured records; expose search/list/stats for Cassandra records
- **Services:** api-server (worker runs in api-server process via Bull; Python parser on host/container PATH)
- **Key Files:**
  - `README.md` - Parsing workflows, API split vs batch-records
  - `feature.yaml` - Routes, worker, diagnostics

**Use Cases:**
- Parse CSV/TXT/VCF/XLS/XLSX (per upload allowlist) automatically
- AI-powered name parsing (OpenAI, Anthropic, DeepSeek)
- Cross-batch record search and batch-level stats
- Queue / Redis diagnostics for operators

---

### 6. Batch Import
**Directory:** `.claude/features/batch-import/`

Field mapping and data import workflow (PLACEHOLDER implementation).

- **Purpose:** Map file columns to card fields and import data
- **Services:** api-server
- **Status:** PLACEHOLDER — service returns mock/structured responses; **Fastify routes are not registered in `api-server/src/app.ts`**, so HTTP API is not live until wired

**Use Cases:**
- Smart field mapping suggestions
- Preview imported data
- Validate before import
- Custom transformation rules

---

### 7. Batch Records
**Directory:** `.claude/features/batch-records/`

Individual record management within batches for editing and validation.

- **Purpose:** Manage contact records within batches
- **Services:** front-cards (records page and components), api-server (CRUD under `/api/batches/:batchId/records`)
- **Key Files:**
  - `README.md` - Record management workflows
  - `feature.yaml` - CRUD endpoints and front-end paths

**Use Cases:**
- View all records in a batch
- Edit individual records
- Delete incorrect records
- Validate records before generation

---

### 8. Batch View
**Directory:** `.claude/features/batch-view/`

Batch listing and detail viewing with filtering and search.

- **Purpose:** UI for batch browsing and management; HTTP calls hit **`/api/batches`** on **api-server**
- **Services:** front-cards; **live** list/stats/delete/upload routes are implemented by **batch-upload** (registered). A separate **`batch-view`** Fastify module exists but is **not** registered — see `README.md` for the split and `GET /api/batches/:id` detail caveat.
- **Key Files:**
  - `README.md` - Viewing workflows and API split
  - `feature.yaml` - Front-end paths and alternate API module

**Use Cases:**
- List all user batches
- Filter by status (uploaded, parsing, parsed, error)
- Search batches by filename
- View batch details and record count

---

## Infrastructure Features

### 9. S3-Bucket Storage
**Directory:** `.claude/features/s3-bucket/`

S3-compatible storage with local fallback for file management.

- **Purpose:** Unified storage interface for files
- **Services:** api-server
- **Key Files:**
  - `README.md` - Storage overview
  - `feature.yaml` - API endpoints

**Use Cases:**
- Upload/download files
- Multipart upload for large files
- Generate presigned URLs
- Bucket management
- Automatic fallback to local storage in dev

---

### 10. Font Management
**Directory:** `.claude/features/font-management/`

Google Fonts integration with caching and metadata storage.

- **Purpose:** Font loading and management for templates
- **Services:** api-server
- **Key Files:**
  - `README.md` - Font workflows
  - `feature.yaml` - Font API

**Use Cases:**
- Load Google Fonts on startup
- Cache fonts for performance
- Provide font metrics for rendering
- Font picker in template designer

---

## UI Features

### 11. Dashboard
**Directory:** `.claude/features/dashboard/`

Main application dashboard with project selector and navigation.

- **Purpose:** Landing page and navigation hub
- **Services:** front-cards
- **Key Files:**
  - `README.md` - Dashboard overview
  - `feature.yaml` - Route mapping

**Use Cases:**
- View recent activity
- Quick access to features
- Switch projects
- Navigate to templates/batches

---

### 12. Render Worker
**Directory:** `.claude/features/render-worker/`

Background **BullMQ** worker service (`render-worker/`) consuming the **`card-rendering`** queue.

- **Purpose:** Generate card images from templates and batch records (pipeline target)
- **Services:** render-worker (Redis); future coupling to api-server, s3-bucket, template-textile, batch-records
- **Status:** Process and queue wiring exist; **`processRenderCard` is a stub** (see `render-worker/src/jobs/render-card.ts`)
- **Key Files:**
  - `README.md` — current scope and file map
  - `feature.yaml` — queue name and paths

**Use Cases:**
- Drain render jobs from Redis
- (Future) Export PNG/JPG and upload to object storage

---

### 13. Simple quick actions
**Directory:** `.claude/features/simple-quick-actions/`

Dashboard **Quick Actions** strip: template designer, batch import (embedded upload), view batches — **disabled until a project is selected**.

- **Purpose:** One entry point for common tasks from the dashboard
- **Services:** front-cards
- **Key Files:**
  - `README.md` — dependencies on simple-projects and batch-upload
  - `feature.yaml` — components and parent page

**Use Cases:**
- Start template design from dashboard
- Upload a batch file in context
- Jump to batch list

---

## Feature Documentation Structure

Each feature directory follows this standardized structure:

```
.claude/features/{feature-name}/
├── README.md              # Business overview, workflows, user stories
├── feature.yaml           # Technical mapping, services, endpoints
└── [supporting docs]      # Additional documentation as needed
```

### README.md Contains
- Feature overview (what it does)
- User stories and use cases
- Key workflows
- Dependencies
- Security considerations
- Configuration requirements

### feature.yaml Contains
- Service implementations
- API endpoints (path, method, auth)
- Database tables
- External dependencies
- Environment variables
- Testing information

---

## How to Use This Index

### Finding a Feature
1. Know the feature name? Go to `.claude/features/{feature-name}/`
2. Want a quick overview? Read `README.md`
3. Looking for code locations? Check `feature.yaml`
4. Need API details? Check service-specific files

### Understanding Feature Scope
- Check feature.yaml to see which services implement the feature
- Review dependencies to understand feature relationships
- Look at endpoints to understand API surface

### Planning Work
1. Read feature's `README.md` for business context
2. Check `feature.yaml` to identify services involved
3. Navigate to service-specific code using paths
4. Review dependencies and integration points

---

## Feature Statistics

- **Total Features:** 13 (numbered sections above)
- **Core Features:** 3 (template-textile, simple-projects, authentication)
- **Batch Processing:** 5 (upload, parsing, import, records, view)
- **Infrastructure:** 2 (s3-bucket, font-management)
- **UI Features:** 2 (dashboard, simple-quick-actions)
- **Workers:** 1 (render-worker)

### Service Coverage

| Service | Features |
|---------|----------|
| front-cards | 7 areas (template-textile, simple-projects, authentication, batch-view, batch-upload UI, dashboard, simple-quick-actions; batch-records UI) |
| api-server | 9 feature modules + global auth middleware (see each `feature.yaml`) |
| render-worker | 1 documented feature (card-rendering queue; handler stubbed) |

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS, Fabric.js |
| Backend | Node.js 20, Fastify, TypeScript 5 |
| Databases | PostgreSQL 16, Cassandra 5, Redis 7 |
| Storage | SeaweedFS (S3-compatible) |
| Queue | BullMQ |
| AI | OpenAI, Anthropic, DeepSeek |

---

## Related Documentation

- **Feature Standard:** `.claude/FEATURE_STANDARD.md` - Guidelines for documenting features
- **Project README:** `README.md` - Project overview and quick start
- **Architecture:** `ARCHITECTURE.md` - Feature-centered architecture details
- **Session Starters:** `.claude/SESSION_STARTERS.md` - Quick context templates

---

Last Updated: 2026-04-22
Project: E-Cards / QR-Code Designer
Maintained by: Engineering Team
