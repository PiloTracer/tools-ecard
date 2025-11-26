# E-Cards System - Claude Context

**Last Updated:** 2025-01-25
**Version:** 1.2.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Domain Models](#domain-models)
4. [Feature Overview](#feature-overview)
5. [Technical Stack](#technical-stack)
6. [Development Approach](#development-approach)
7. [External Integrations](#external-integrations)
8. [Legacy System Preservation](#legacy-system-preservation)
9. [Environment Configuration](#environment-configuration)
10. [Project Status](#project-status)
11. [Implementation Guidelines](#implementation-guidelines)

---

## Executive Summary

### What This Project Does

A modern, browser-based designer application that enables users to create card templates and batch-generate personalized e-cards and QR codes. This system replaces a legacy C# WPF + Adobe InDesign pipeline with a scalable, web-based solution.

### Key Objectives

- Enable template-based card design with drag-and-drop interface
- Support batch import from Excel and text with intelligent name parsing
- Preserve existing layout logic from legacy InDesign system
- Integrate with external authentication, subscription, and storage services
- Provide real-time preview and high-quality export capabilities

### Core Business Workflows

1. **Template Creation**: Upload background, add text/image/QR elements, configure fonts/colors/layout rules, save for reuse
2. **Batch Card Generation**: Import staff data, map fields to template, preview cards, generate in background, download results
3. **Name Parsing Intelligence**: If user has LLM credits, parse complex names (e.g., "Pilo Cantor Jimente" → firstName: "Pilo", lastName: "Cantor Jimente"); otherwise save as-is

---

## System Architecture

### High-Level Overview

```
┌─────────────────────── EXTERNAL SERVICES (Remote) ─────────────────────────┐
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │  Auth & User     │  │  Subscription    │  │  LLM Service     │         │
│  │  Management API  │  │  (WebSocket)     │  │  (Name Parse)    │         │
│  │  (Remote)        │  │                  │  │                  │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │              SeaweedFS (Remote Storage)                     │           │
│  │          Separate build - accessed as client                │           │
│  └─────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                         ▲ HTTPS/WSS (Client connections)
                         │
     ┌───────────────────┴────────────────────┐
     │                                        │
     ▼                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                         front-cards                             │
│               (Next.js 16 Web App - Public Facing)              │
│  Features: auth, template-designer, batch-import,               │
│            batch-management, name-parser, user-profile          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ REST + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         api-server                              │
│        (Internal Node.js Backend - NOT the external auth)       │
│  Features: auth-middleware, template-api, batch-api,            │
│            render-queue, storage-proxy, subscription-sync,      │
│            rate-limiter                                         │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │    │    Redis     │    │  Cassandra   │
│ (Normalized) │    │  (Queue +    │    │ (Canonical   │
│   (Local)    │    │   Cache)     │    │  Event Log)  │
└──────────────┘    └──────────────┘    └──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       render-worker                             │
│                  (Background Job Processor)                     │
│  Features: card-renderer, layout-calculator, text-fitting,      │
│            qr-generator, export-handler, seaweedfs-uploader     │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Architecture Points

1. **api-server is INTERNAL**: This is NOT the external authentication API. It's the E-Cards application backend that communicates with the external auth service as a client.

2. **External Auth & User Management API**: Separate service that handles authentication, user profiles, subscriptions. E-Cards app receives JWT tokens from this service.

3. **SeaweedFS is REMOTE**: Already deployed as a separate service. E-Cards application connects as a client only. No local SeaweedFS in this docker-compose.

4. **Local Services** (in this build):
   - PostgreSQL: E-Cards application data
   - Cassandra: E-Cards event logs
   - Redis: Job queue and caching
   - front-cards: Public web interface
   - api-server: Internal backend API
   - render-worker: Background job processor

### Feature-Based Organization

All services follow consistent feature-based organization:

```
/front-cards/features/{feature-name}/
  ├── components/      # UI components
  ├── hooks/           # React hooks
  ├── services/        # API clients (MOCK initially)
  ├── types/           # Feature-specific types
  ├── index.ts         # Public exports
  └── README.md        # Feature documentation

/api-server/src/features/{feature-name}/
  ├── controllers/     # Request handlers
  ├── services/        # Business logic (MOCK initially)
  ├── repositories/    # Data access (MOCK initially)
  ├── validators/      # Input validation
  ├── routes.ts        # Express routes
  ├── types.ts         # Feature-specific types
  └── README.md        # Feature documentation

/render-worker/src/features/{feature-name}/
  ├── processors/      # Job processors
  ├── services/        # Core logic (MOCK initially)
  ├── utils/           # Feature-specific utilities
  ├── types.ts
  └── README.md
```

---

## Domain Models

### User

```typescript
type User = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  subscriptionTier: 'free' | 'basic' | 'professional' | 'enterprise';
  rateLimit: {
    cardsPerMonth: number;
    currentUsage: number;
    llmCredits: number;
    resetDate: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};
```

### Template

```typescript
type Template = {
  id: string;
  userId: string;
  name: string;
  backgroundUrl: string; // SeaweedFS URL
  width: number;
  height: number;
  elements: TemplateElement[];
  phonePrefix?: string; // e.g., "2459-"
  extensionLength?: number; // default: 4
  exportDpi: number; // default: 300
  brandColors: Record<string, string>; // e.g., { "CodeBlue": "#0066CC" }
  createdAt: Date;
  updatedAt: Date;
};

type TemplateElement = TextElement | ImageElement | QRCodeElement;

type TextElement = {
  id: string;
  kind: 'text';
  name: string; // e.g., "Nombre", "Cargo"
  field: string; // e.g., "fullName", "position"
  x: number;
  y: number;
  maxWidth?: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  autoFit?: AutoFitConfig;
  styleRules?: TextStyleRule[]; // For multi-color text
};

type AutoFitConfig = {
  enabled: boolean;
  minSize: number; // e.g., 4
  maxSize: number; // e.g., 18
  singleLine: boolean;
};

type TextStyleRule =
  | { type: 'firstWord'; color: string }
  | { type: 'rest'; color: string };

type ImageElement = {
  id: string;
  kind: 'image';
  name: string; // e.g., "Phone", "WhatsApp"
  assetUrl: string; // SeaweedFS URL
  x: number;
  y: number;
  visibleByDefault: boolean;
  visibilityField?: string; // e.g., "phoneShow"
  dynamicXField?: string;
  dynamicYField?: string;
};

type QRCodeElement = {
  id: string;
  kind: 'qr';
  name: string;
  field: string; // e.g., "email", "vcard"
  x: number;
  y: number;
  size: number;
  colorDark: string;
  colorLight: string;
};
```

### Batch

```typescript
type Batch = {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  importSource: 'excel' | 'text' | 'api';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};
```

### CanonicalStaff (Individual Record)

```typescript
type CanonicalStaff = {
  id: string;
  batchId: string;

  // Name fields (parsed or as-is)
  fullName: string; // Always populated
  firstName?: string; // If parsed by LLM or explicit
  middleName?: string;
  lastName?: string;
  secondLastName?: string;

  // Job details
  position: string;
  department?: string;

  // Contact
  email: string;
  telRaw?: string; // Original input
  phone?: string; // Parsed phone number
  extension?: string; // Parsed extension
  whatsapp?: string;
  web?: string; // Default: www.codedg.com

  // Layout (computed)
  layout: StaffLayout;

  // File naming
  fileSlug: string; // Clean email-based identifier
  fileNameKey: string; // Unique key with hash

  // Metadata
  extra?: Record<string, string>; // Custom fields
  createdAt: Date;
  updatedAt: Date;
};

type StaffLayout = {
  // Text sizing (computed by auto-fit algorithm)
  nameSize: number;
  cargoSize: number;

  // Icon positions and visibility
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

  // Additional text fields
  texto1: string;
  texto2: string;
  texto3: string;
};
```

### RenderJob

```typescript
type RenderJob = {
  id: string;
  batchId: string;
  recordId: string;
  templateId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  maxAttempts: number;
  outputUrl?: string; // SeaweedFS URL
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};
```

---

## Feature Overview

### Priority Features

| Feature | Priority | Status | Description |
|---------|----------|--------|-------------|
| **auto-auth** | HIGH | Planned | OAuth 2.0 + PKCE integration with external auth service |
| **database-setup** | HIGH | Planned | Prisma schema, migrations, seed data |
| **template-designer** | HIGH | Planned | Visual canvas editor for card layouts |
| **batch-import** | HIGH | Planned | Excel/text parsing with field mapping |
| **render-worker** | HIGH | Planned | Background card rendering engine |
| **batch-management** | MEDIUM | Planned | List, preview, download batches |
| **name-parser** | MEDIUM | Planned | LLM-assisted name field parsing |
| **user-profile** | LOW | Planned | Settings, limits, font/color management |

**Implementation Order**: See `.claude/features/feature-order.md`

### Core Features Brief

**Auto-Auth (OAuth 2.0 + PKCE)**
- Seamless SSO from external auth service
- Security: PKCE, state parameter, httpOnly cookies, encrypted refresh tokens
- JWT validation middleware

**Template Designer**
- Visual canvas editor (Fabric.js/Konva)
- Text, image, QR code elements
- Auto-fit text algorithm
- Background upload to SeaweedFS

**Batch Import**
- Excel/text parsing
- Field mapping UI
- LLM name parsing (with credit system)
- Phone vs extension detection

**Render Worker**
- BullMQ job processor
- Canvas/Puppeteer rendering
- Replicates InDesign layout logic
- Exports to SeaweedFS

**Batch Management**
- List batches with filters
- Preview cards
- Download ZIP or individual
- Regenerate failed cards

---

## Technical Stack

### Frontend (front-cards)
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **State Management**: React Context + Zustand
- **Canvas**: Fabric.js or Konva.js
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Fetch API with custom wrapper
- **WebSocket**: Native WebSocket API

### Backend (api-server)
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5+
- **Framework**: Fastify (high performance)
- **Validation**: Zod
- **ORM**: Prisma (PostgreSQL)
- **Queue**: BullMQ (Redis)
- **WebSocket**: ws library
- **File Handling**: multer
- **Excel Parsing**: xlsx library
- **Authentication**: jsonwebtoken

### Render Worker (render-worker)
- **Runtime**: Node.js 20+
- **Canvas**: node-canvas or Puppeteer (headless Chrome)
- **Image Processing**: sharp
- **QR Generation**: qrcode library
- **Font Loading**: opentype.js
- **Job Processing**: BullMQ worker

### Databases
- **PostgreSQL 16**: User data, templates, batches, jobs (ACID compliance)
- **Cassandra 5**: Event logs, audit trails, time-series data
  - **Note**: Materialized views disabled by default in Cassandra 5.0
  - All schemas in `db/init-cassandra/` (single source of truth)
  - Automated initialization via db-init service
- **Redis 7**: Job queue, cache, session storage

### Storage
- **SeaweedFS** (Remote): Distributed object storage for templates, fonts, generated outputs, user assets

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Development Ports**: 7xxx series (7300 frontend, 7400 api, 7432 postgres, etc.)
- **Production Ports**: Standard (3000, 4000, 5432, etc.)

---

## Development Approach

### Feature-Based Development Principles

1. **Feature Identification**: Each functionality has a unique feature name
2. **Isolated Development**: Features developed in isolation with clear interfaces
3. **Shared Resources**: Common utilities, components, types live in `/shared`
4. **Context Management**: Each feature manages its own context/state
5. **Testing**: Each feature has its own test suite

### Mock-First Development

All services include mock implementations:

```typescript
// MOCK: Template service with failure simulation
export const templateService = {
  async getTemplate(id: string): Promise<Template> {
    // MOCK: Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Simulate not found error (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('Template not found');
    }

    // MOCK: Return mock data
    return MOCK_TEMPLATE;
  }
};
```

**Mock Conventions**:
- Explicit marking: Use `// MOCK` comments
- Failure simulation: Include error cases
- Realistic delays: 200-800ms
- Type safety: Mock data must match TypeScript types

### Critical Implementation Rules

1. **Feature Isolation**: Features MUST NOT import from other features. Shared code goes in `/shared` or `packages/shared-types`.

2. **Mock Completeness**: Every service method must have mock implementation. Include `// TODO [OWNER]: [ACTION]` for real implementations.

3. **Type Safety**: All API boundaries use shared types. No `any` types in production code. Use Zod for runtime validation.

4. **Error Handling**: All async functions must handle errors. Use custom error classes. Never expose internal errors to clients.

5. **Testing**: Every feature module requires tests covering happy path + error cases.

---

## External Integrations

### 1. Authentication Service (Remote)

**Purpose**: Central SSO and user management

**Integration Points**:
- Login/Logout: Redirect to external auth page
- JWT Validation: Verify tokens on each API request
- Token Refresh: Automatic token renewal
- User Info: Fetch user profile and permissions

**API Endpoints**:
```
POST /auth/login → Redirect URL
POST /auth/logout
GET  /auth/user → User profile
POST /auth/refresh → New JWT
```

### 2. Subscription Service (WebSocket)

**Purpose**: Real-time subscription status and rate limits

**Message Types**:
- `LIMIT_UPDATE`: Rate limit changes
- `SUBSCRIPTION_CHANGED`: Tier upgrade/downgrade
- `ACCOUNT_SUSPENDED`: Account suspension
- `CREDIT_ADDED`: LLM credits added

### 3. LLM Name Parser API

**Purpose**: Intelligent name field parsing

**Supported Providers**:
1. **OpenAI** (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
2. **Anthropic** (Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus)
3. **DeepSeek** (deepseek-chat, deepseek-coder)
4. **External** (Custom LLM API endpoint)

**Provider Strategy**:
- Primary + Fallback pattern
- All users use same configured primary provider
- If primary fails, automatic fallback
- If both fail, save as `fullName` only (confidence = 0)

**Credit System**:
- Flat rate: **1 credit per call** (regardless of provider)
- Credits checked and deducted BEFORE calling LLM
- If user has 0 credits, skip LLM (save as `fullName` only)

**API Endpoint**:
```
POST /llm/parse-name
Request: {
  fullName: string;
  locale?: string; // e.g., "es-CR" for Costa Rica
}
Response: {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  confidence: number; // 0-1
  creditsUsed: number; // Always 1
}
```

### 4. SeaweedFS (Remote Bucket Storage)

**Purpose**: Distributed file storage

**S3-Compatible API**:
```
PUT /users/{userId}/templates/{templateId}/background.png
GET /users/{userId}/batches/{batchId}/cards/{recordId}.png
GET /users/{userId}/batches/{batchId}/?prefix=cards/
DELETE /users/{userId}/templates/{templateId}/background.png
```

**Directory Structure**:
```
/users
  /{userId}
    /templates/{templateId}/background.png
    /templates/{templateId}/fonts/custom-font.ttf
    /batches/{batchId}/cards/{recordId}.png
    /batches/{batchId}/archive.zip
    /assets/icons
    /assets/logos
```

---

## Legacy System Preservation

### InDesign JSX Script Behavior

The legacy system uses `GenerateCardsBvars.jsx` with specific behaviors that MUST be preserved:

#### 1. Named InDesign Objects
- Text frames: `"Nombre"`, `"Cargo"`, `"Texto1"`, `"Texto2"`, `"Texto3"`
- Images: `"In"`, `"Phone"`, `"Whatsapp"`, `"Web"`

#### 2. Brand Colors & Per-Word Styling

Legacy JSX:
```javascript
// Name frame: "Pilo Cantor Jimente"
// Characters 0-3 (length of "Pilo") → CodeBlue
// Characters 4-end → Black
```

New template system:
```typescript
{
  kind: 'text',
  name: 'Nombre',
  field: 'fullName',
  styleRules: [
    { type: 'firstWord', color: '#0066CC' }, // CodeBlue
    { type: 'rest', color: '#000000' }
  ]
}
```

#### 3. Auto-Fit Text Algorithm

Legacy JSX:
```javascript
function fitTextInFrame(textFrame, maxSize) {
  var minSize = 4;
  var currentSize = maxSize;

  while (textFrame.overflows && currentSize > minSize) {
    currentSize -= 0.1;
    textFrame.pointSize = currentSize;
  }

  return currentSize;
}
```

New renderer (TypeScript):
```typescript
function autoFitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number = 4
): number {
  let fontSize = maxSize;
  ctx.font = `${fontSize}px Arial`;

  while (ctx.measureText(text).width > maxWidth && fontSize > minSize) {
    fontSize -= 0.1;
    ctx.font = `${fontSize}px Arial`;
  }

  return fontSize;
}
```

#### 4. Dynamic "In" Icon Positioning

Legacy JSX:
```javascript
var InXLimit = Math.max(
  getTextRightEdge(nameFrame),
  getTextRightEdge(positionFrame)
) + 4;

InXLimit = Math.max(487.8415, Math.min(InXLimit, 506.91));

inImage.move([InXLimit, record.InY]);
```

New template:
```typescript
{
  kind: 'image',
  name: 'In',
  assetUrl: 'seaweedfs://icons/linkedin.png',
  dynamicX: {
    type: 'computed',
    formula: 'clamp(max(textRightEdge("Nombre"), textRightEdge("Cargo")) + 4, 487.84, 506.91)'
  },
  y: 50
}
```

#### 5. Export Settings

Legacy JSX:
```javascript
pngOptions.exportResolution = 144;
pngOptions.pngQuality = PNGQuality.MAXIMUM;
pngOptions.antiAlias = true;
pngOptions.useDocumentBleeds = false;
```

New renderer:
```typescript
{
  exportDpi: 144, // or 300 for higher quality
  quality: 100,
  antiAlias: true,
  bleed: false
}
```

### Phone vs Extension Detection

**Logic**:
- Config fields: `phonePrefix` (e.g., `"2459-"`), `extensionLength` (default: 4)
- If raw input is 4 digits → treat as extension; phone = prefix + extension
- If raw input contains prefix + 4 digits → treat as phone
- If raw input like `"2459-7584 / 1234"`:
  - Split on `/;|,`
  - Part with prefix = phone; 4-digit part = extension

---

## Environment Configuration

### Security Pre-requirements

1. **NEVER READ** the `.env` file for security reasons
2. **YOU CAN READ AND MODIFY** `.env.dev.example` and `.env.prod.example` (both should have the same KEYS)

### Key Environment Variables

All services now pull from root-level `.env.dev.example` and `.env.prod.example`.

**Database**:
```bash
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ecards_db
POSTGRES_USER=ecards_user
POSTGRES_PASSWORD=ecards_dev_password

CASSANDRA_HOSTS=cassandra
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=ecards_canonical  # All schemas auto-created by db-init service
CASSANDRA_DC=dc1

REDIS_HOST=redis
REDIS_PORT=6379
```

**Service Ports**:
```bash
# Development (7xxx series)
FRONTEND_PORT=7300
API_PORT=7400
API_INTERNAL_PORT=4000
POSTGRES_PORT_EXTERNAL=7432
CASSANDRA_PORT_EXTERNAL=7042
REDIS_PORT_EXTERNAL=7379

# Public URLs
API_URL=http://localhost:7400
NEXT_PUBLIC_API_URL=http://localhost:7400
NEXT_PUBLIC_WS_URL=ws://localhost:7400
```

**LLM Configuration** (Name Parsing):
```bash
LLM_ENABLED=true
LLM_PRIMARY_PROVIDER=openai          # openai | anthropic | deepseek | external
LLM_FALLBACK_PROVIDER=deepseek       # openai | anthropic | deepseek | external | none
LLM_CREDIT_COST=1                    # Flat rate: 1 credit per call
LLM_RETRY_ATTEMPTS=2
LLM_TIMEOUT_MS=10000

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_MAX_TOKENS=500
ANTHROPIC_TEMPERATURE=0.3

# DeepSeek Configuration
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_MAX_TOKENS=500
DEEPSEEK_TEMPERATURE=0.3
```

**External Services** (Remote):
```bash
# SeaweedFS (Remote Storage)
SEAWEEDFS_ENDPOINT=http://remote-seaweedfs-host:8888
SEAWEEDFS_ACCESS_KEY=your_seaweedfs_access_key
SEAWEEDFS_SECRET_KEY=your_seaweedfs_secret_key
SEAWEEDFS_BUCKET=templates

# External Auth & User Management API (NOT this api-server)
EXTERNAL_AUTH_URL=http://remote-auth-server:5000
EXTERNAL_SUBSCRIPTION_WS=ws://remote-auth-server:5000/ws
EXTERNAL_USER_API=http://remote-auth-server:5000/api/users

# LLM Service (Backward Compatibility)
EXTERNAL_LLM_API=http://remote-llm-server:5000/api/llm
```

**JWT** (Internal session management):
```bash
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRY=7d
```

**Render Worker**:
```bash
WORKER_CONCURRENCY=4
WORKER_MAX_ATTEMPTS=3
WORKER_TIMEOUT=60000
RENDER_ENGINE=puppeteer # or 'node-canvas'
```

---

## Project Status

### ✅ Completed Components

1. **Project Documentation**
   - ARCHITECTURE.md (feature-centered scaffolding)
   - CLAUDE_CONTEXT.md (comprehensive project documentation)
   - README.md (quick start guide)
   - .claude/SESSION_STARTERS.md (session templates)

2. **Shared Types Package**
   - `/packages/shared-types/` with all domain models
   - User, Template, Batch, CanonicalStaff types
   - API Request/Response contracts
   - TypeScript build configuration

3. **API Server** (`/api-server`)
   - Directory structure with feature-based organization
   - Package.json with all dependencies
   - Dockerfile.dev for containerization
   - Core configuration (config, database connections)
   - Fastify app setup with health check endpoint
   - Server entry point with graceful shutdown
   - Prisma schema placeholder
   - Error handling middleware

4. **Front-Cards** (`/front-cards`)
   - Next.js 16 application initialized
   - Updated package.json with project dependencies
   - Dockerfile.dev for containerization
   - API client utility
   - Updated README with project-specific info

5. **Render Worker** (`/render-worker`)
   - Directory structure for background processing
   - Package.json with rendering dependencies (canvas, sharp, qrcode)
   - Dockerfile.dev with canvas dependencies
   - BullMQ queue setup
   - Worker entry point with job processing
   - Mock render job handler

6. **Docker Infrastructure**
   - docker-compose.dev.yml with all services
   - Custom port mappings (7xxx ports)
   - PostgreSQL, Cassandra, Redis containers
   - Database services running and healthy
   - db-init service for automated Cassandra schema initialization

7. **Database Schema Management** (as of 2025-01-25)
   - Cassandra schemas consolidated in `db/init-cassandra/`
   - Automated initialization via db-init service (no manual steps)
   - Materialized views disabled (Cassandra 5.0 default)
   - Project IDs auto-generated (UUID) - no hardcoded values
   - See `.claude/fixes/` for recent fix documentation

### 🔧 Current Status

**Database Services**: ✅ Running and Healthy
- PostgreSQL: Healthy (port 7432)
- Cassandra: Healthy (port 7042) - **Schemas auto-initialized**
- Redis: Healthy (port 7379)

**Cassandra Schema Status** (Updated 2025-01-25):
- ✅ Keyspace: `ecards_canonical` (created automatically)
- ✅ All tables created by db-init service
- ⚠️ Materialized views: Disabled (Cassandra 5.0 default)
- ✅ Schema files: `db/init-cassandra/*.cql`
- ✅ No manual initialization required

**Application Services**: Ready for development
- api-server: Build succeeded (recent fixes applied)
- front-cards: Ready
- render-worker: Ready

**Recent Fixes** (2025-01-25):
- ✅ Fixed Cassandra schema initialization (materialized views disabled)
- ✅ Fixed Prisma unique constraint error (removed hardcoded project IDs)
- ✅ Consolidated all schemas to `db/init-cassandra/`
- ✅ Implemented structured Pino logging (replaced 76+ console statements)
- ✅ Configured log rotation (10MB max, 3 files)
- 📋 See `.claude/fixes/` for detailed documentation
- 📋 See `api-server/LOGGING.md` for logging documentation

### 🚀 Next Steps

**Immediate**:
1. Complete Docker build: `docker-compose -f docker-compose.dev.yml up --build -d`
2. Verify all services are running
3. Test endpoints (API health check, frontend)
4. Connect to databases

**Implementation Roadmap** (16 weeks):

- **Week 1-2**: Core Infrastructure (Prisma schema, migrations, auth middleware, WebSocket)
- **Week 3-4**: Template Designer (canvas editor, element manipulation, SeaweedFS upload)
- **Week 5-6**: Batch Import (Excel/text parsing, field mapping, LLM integration)
- **Week 7-8**: Rendering Engine (card rendering, layout logic, auto-fit, export)
- **Week 9**: Batch Management (list view, preview, download, real-time progress)
- **Week 10-11**: Render Worker refinement
- **Week 12**: SeaweedFS Integration completion
- **Week 13**: External API Integrations
- **Week 14**: Testing & QA
- **Week 15-16**: Polish & Documentation

---

## Implementation Guidelines

### Data Flow: Batch Import & Generation

```
1. User uploads Excel/pastes text → Front-cards
2. Front-cards: Parse and preview data
3. User maps fields → Front-cards
4. User submits batch → Front-cards
5. Front-cards → API Server: POST /api/batches
6. API Server:
   a. Validate user rate limits (check subscription)
   b. Parse records (call LLM if credits available)
   c. Calculate layouts for each record
   d. Store batch + records in PostgreSQL
   e. Create render jobs in Redis queue (BullMQ)
   f. Return batch ID
7. Render Worker (BullMQ consumer):
   For each job:
   a. Fetch template + record from PostgreSQL
   b. Load background from SeaweedFS
   c. Render card to canvas
   d. Apply layout logic (auto-fit, colors, icons)
   e. Export to PNG/JPG
   f. Upload to SeaweedFS
   g. Update job status in PostgreSQL
   h. Emit progress event via WebSocket
8. Front-cards (WebSocket listener):
   Update progress bar in real-time
9. User downloads results → Front-cards
10. Front-cards → API Server: GET /api/batches/{id}/download
11. API Server → SeaweedFS: Fetch files or create ZIP
12. API Server → Front-cards: Stream download
```

### Name Parsing Flow

```
1. API Server receives staff record
2. Check record for explicit fields (firstName, lastName)
3. If explicit fields exist:
   → Use them directly
4. If only fullName exists:
   a. Check user LLM credits
   b. If credits > 0:
      → Call external LLM API (primary provider)
      → If primary fails, try fallback provider
      → Deduct 1 credit
      → Parse name into fields
   c. If credits = 0:
      → Save fullName as-is
      → Leave firstName/lastName undefined
5. Return parsed CanonicalStaff record
```

### Porting C# Logic to TypeScript

**Functions to Port** (from legacy C# system):

1. **NameParser**: Parse full names into components
2. **ValidateString**: String validation and cleaning
3. **ToTitleCaseCorrect**: Proper case conversion
4. **GetEmailClean**: Generate clean file slugs from email
5. **CalculateLayout**: Compute StaffLayout from CanonicalStaff
6. **FormatCostaRicanPhoneNumber**: Phone formatting
7. **Phone vs Extension Detection**: Parse telRaw into phone/extension

**Example Port**:

C# (original):
```csharp
public static string ValidateString(string input) {
    if (string.IsNullOrWhiteSpace(input)) return "";
    return input.Trim().Replace("  ", " ");
}
```

TypeScript (new):
```typescript
export function validateString(input: string | null | undefined): string {
  if (!input || input.trim() === '') return '';
  return input.trim().replace(/\s+/g, ' ');
}
```

### Logging Standards

**CRITICAL**: All code MUST use structured Pino logging. **NEVER use console.log/error/warn/debug**.

**Setup** (once per file):
```typescript
import { createLogger } from './core/utils/logger';

const log = createLogger('ModuleName');
```

**Usage**:
```typescript
// ✅ Correct - Structured logging with context
log.info({ userId, templateId }, 'Template saved successfully');
log.error({ error, templateId }, 'Failed to save template');
log.debug({ projectId, storageMode }, 'Processing template');

// ❌ Wrong - Never use console
console.log('Template saved:', templateId);  // NEVER DO THIS
console.error('Failed:', error);              // NEVER DO THIS
```

**Log Levels** (use appropriately):
- `trace`: Very detailed debugging (function entry/exit)
- `debug`: Development diagnostics - NOT shown in production by default
- `info`: Important application events (server started, template saved)
- `warn`: Warning conditions (missing optional data, degraded mode)
- `error`: Error conditions (failed operations, caught exceptions)
- `fatal`: Critical errors causing shutdown

**Best Practices**:
1. **Always use structured context**: First parameter is object with data, second is message
2. **Include relevant IDs**: userId, templateId, batchId, etc. for traceability
3. **Log errors with error object**: `log.error({ error, context }, 'Message')`
4. **Use appropriate levels**: Don't log routine operations at `info` level
5. **Never log sensitive data**: passwords, tokens, API keys, PII
6. **Create module-specific loggers**: One per file with meaningful module name

**Environment Configuration**:
```bash
LOG_LEVEL=info    # Development: info, Production: warn
DEBUG=*,-prisma:* # Exclude Prisma query logs (verbose)
```

**Log Rotation**: Configured in docker-compose.dev.yml (10MB max file size, 3 files retained)

**Migration Status**: All core files migrated from console.log to Pino (2025-01-25)

**See Also**: `api-server/LOGGING.md` for complete logging documentation

### Security Considerations

**Authentication & Authorization**:
- All API endpoints require valid JWT
- Token expiry and refresh mechanisms
- Role-based access control (RBAC)
- User isolation (cannot access other users' data)

**Input Validation**:
- Zod schemas for all API inputs
- File upload validation (type, size, malware scan)
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (sanitize user inputs)

**Data Privacy**:
- Names sent to external LLM providers (compliance with GDPR, CCPA)
- Encrypted passwords (bcrypt)
- Secure token storage (httpOnly cookies)
- Audit logs in Cassandra

**File Storage Security**:
- Signed URLs for SeaweedFS downloads
- Private buckets by default
- Virus scanning on uploads
- Size limits per user tier

### Performance Targets

**API Server**:
- p95 response time: <200ms
- p99 response time: <500ms
- Throughput: 1000 req/s

**Render Worker**:
- Single card render: <2s
- Batch of 100 cards: <3 minutes
- Concurrent jobs: 20 per worker instance

**Database**:
- PostgreSQL query time: <50ms (p95)
- Cassandra write time: <10ms (p95)
- Redis operations: <1ms (p99)

**Storage (Remote SeaweedFS)**:
- File upload: <1s for 5MB file
- File download: <500ms for 5MB file
- Network latency to remote SeaweedFS: <50ms

---

## Quick Reference

### Docker Commands

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Start in detached mode
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f [service-name]

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (reset databases)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yml up --build
```

### Service Endpoints (Development)

- **Frontend**: http://localhost:7300
- **API Server**: http://localhost:7400
- **API Health Check**: http://localhost:7400/health
- **PostgreSQL**: localhost:7432
- **Cassandra**: localhost:7042
- **Redis**: localhost:7379

### Database Access

```bash
# PostgreSQL
psql -h localhost -p 7432 -U ecards_user -d ecards_db
# Password: ecards_dev_password

# Cassandra
docker exec -it ecards-cassandra cqlsh

# Redis
docker exec -it ecards-redis redis-cli
```

### Folder Structure

```
/tools-ecards
├── .claude/                      # Claude Code context
│   ├── SESSION_STARTERS.md       # Session templates
│   └── features/                 # Feature specifications
├── packages/
│   └── shared-types/             # Shared TypeScript types
├── front-cards/                  # Next.js 16 frontend
├── api-server/                   # Internal Node.js backend
├── render-worker/                # Background job processor
├── db/                           # Database initialization
├── docker-compose.dev.yml
├── CLAUDE_CONTEXT.md             # THIS FILE - Complete context
├── CLAUDE_CONTEXT.md                    # Detailed project docs
├── ARCHITECTURE.md               # Feature-centered architecture
└── README.md                     # Quick start guide
```

### Code Standards

- **TypeScript strict mode** - No `any` types
- **Feature isolation** - No cross-feature imports
- **Explicit TODOs** - `// TODO [OWNER]: [ACTION]`
- **Mock markers** - `// MOCK: Description`
- **Tests required** - Every feature module
- **Structured logging** - Use Pino logger, NEVER console.log (see Logging Standards section)

---

**End of Context Document**

This consolidated document contains all critical information from the root .md files without duplication. Use it as the single source of truth when working with Claude Code.
