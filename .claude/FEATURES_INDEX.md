# Features Index

Complete index of all documented features in the E-Cards project. Each feature has standardized documentation in `.claude/features/`.

## Quick Navigation

- [Core Features](#core-features)
- [Batch Processing Features](#batch-processing-features)
- [Infrastructure Features](#infrastructure-features)
- [UI Features](#ui-features)

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

## Batch Processing Features

### 3. Batch Upload
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

### 4. Batch Parsing
**Directory:** `.claude/features/batch-parsing/`

Background worker for parsing uploaded files with LLM-assisted name parsing.

- **Purpose:** Parse files asynchronously into structured records
- **Services:** api-server
- **Key Files:**
  - `README.md` - Parsing workflows
  - `feature.yaml` - Worker configuration

**Use Cases:**
- Parse CSV/TXT/VCF files automatically
- AI-powered name parsing (OpenAI, Anthropic, DeepSeek)
- Progress tracking
- Error handling and reporting

---

### 5. Batch Import
**Directory:** `.claude/features/batch-import/`

Field mapping and data import workflow (PLACEHOLDER implementation).

- **Purpose:** Map file columns to card fields and import data
- **Services:** api-server
- **Status:** PLACEHOLDER - Mock responses only

**Use Cases:**
- Smart field mapping suggestions
- Preview imported data
- Validate before import
- Custom transformation rules

---

### 6. Batch Records
**Directory:** `.claude/features/batch-records/`

Individual record management within batches for editing and validation.

- **Purpose:** Manage contact records within batches
- **Services:** api-server
- **Key Files:**
  - `README.md` - Record management workflows
  - `feature.yaml` - CRUD endpoints

**Use Cases:**
- View all records in a batch
- Edit individual records
- Delete incorrect records
- Validate records before generation

---

### 7. Batch View
**Directory:** `.claude/features/batch-view/`

Batch listing and detail viewing with filtering and search.

- **Purpose:** UI for batch browsing and management
- **Services:** front-cards, api-server
- **Key Files:**
  - `README.md` - Viewing workflows
  - `feature.yaml` - List/detail endpoints

**Use Cases:**
- List all user batches
- Filter by status (uploaded, parsing, parsed, error)
- Search batches by filename
- View batch details and record count

---

## Infrastructure Features

### 8. S3-Bucket Storage
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

### 9. Font Management
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

### 10. Dashboard
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

- **Total Features:** 10
- **Core Features:** 2 (template-textile, simple-projects)
- **Batch Processing:** 5 (upload, parsing, import, records, view)
- **Infrastructure:** 2 (s3-bucket, font-management)
- **UI Features:** 1 (dashboard)

### Service Coverage

| Service | Features |
|---------|----------|
| front-cards | 5 features (template-textile, simple-projects, batches, dashboard, batch-view) |
| api-server | 9 features (all except dashboard) |
| render-worker | 0 features (uses batch-records data) |

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

Last Updated: 2025-11-28
Project: E-Cards / QR-Code Designer
Maintained by: Engineering Team
