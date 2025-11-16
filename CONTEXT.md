# E-Cards System - Project Context Documentation

## Pre-requirements:
1. NEVER READ the .env file for security reasons
2. YOU CAN READ AND MODIFY the .env.dev.example and the .env.prod.example, both should have the same KEYS.

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture](#architecture)
4. [Domain Models](#domain-models)
5. [Features](#features)
6. [Technical Stack](#technical-stack)
7. [Development Approach](#development-approach)
8. [External Integrations](#external-integrations)
9. [Data Flow](#data-flow)
10. [Implementation Stages](#implementation-stages)
11. [.claude Folder Structure](#claude-folder-structure)

---

## Executive Summary

The E-Cards System is a modern, browser-based designer application that enables users to create card templates and batch-generate personalized e-cards and QR codes. This system replaces a legacy C# WPF + Adobe InDesign pipeline with a scalable, web-based solution.

### Key Objectives
- Enable template-based card design with drag-and-drop interface
- Support batch import from Excel and loose text with intelligent name parsing
- Preserve existing layout logic from legacy InDesign system
- Integrate with external authentication, subscription, and storage services
- Provide real-time preview and high-quality export capabilities

---

## System Overview

### Business Context
Organizations need to generate personalized business cards, ID cards, and QR-coded materials at scale. The legacy system using Adobe InDesign scripting is being replaced with a modern web application that provides:

- **Template Designer**: Visual editor for creating card layouts
- **Batch Processing**: Import and process hundreds/thousands of records
- **Smart Parsing**: LLM-assisted name field parsing with fallback mechanisms
- **Multi-tenant**: User isolation with subscription-based rate limiting
- **Distributed Storage**: Remote SeaweedFS for templates, fonts, and generated assets

### Core User Workflows

1. **Template Creation**
   - Upload background image
   - Add text fields (name, position, contact info)
   - Configure fonts, colors, and layout rules
   - Add dynamic icons (phone, WhatsApp, web, LinkedIn)
   - Define QR code placement and styling
   - Save template for reuse

2. **Batch Card Generation**
   - Import staff data (Excel or text paste)
   - Map columns to template fields
   - Preview individual cards
   - Generate all cards in background
   - Download ZIP or individual files

3. **Name Parsing Intelligence**
   - If user has LLM credits: Parse "Pilo Cantor Jimente" → firstName: "Pilo", lastName: "Cantor Jimente"
   - If no credits: Save as-is in single name field
   - Support explicit field mapping (firstName, middleName, lastName, secondLastName)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        External Services (Remote)                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │  Auth & User   │  │  Subscription  │  │  LLM Service   │         │
│  │  Management    │  │   (WebSocket)  │  │  (Name Parse)  │         │
│  │  API (Remote)  │  │                │  │                │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│         ▲                    ▲                    ▲                 │
│         │                    │                    │                 │
│  ┌────────────────────────────────────────────────────────┐         │
│  │              SeaweedFS (Remote Storage)                │         │
│  │          Separate build - accessed as client           │         │
│  └────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                         ▲ HTTPS/WSS (Client connections)
                         │
     ┌───────────────────┴────────────────────┐
     │                                        │
     ▼                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                         front-cards                             │
│               (Next.js 16 Web App - Public Facing)              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Features:                                                  │ │
│  │ • auth (SSO integration with external auth service)        │ │
│  │ • template-designer (canvas editor)                        │ │
│  │ • batch-import (Excel/text parsing)                        │ │
│  │ • batch-management (list, preview, download)               │ │
│  │ • name-parser (LLM integration)                            │ │
│  │ • user-profile (settings, limits)                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ REST/GraphQL + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         api-server                              │
│        (Internal Node.js Backend - NOT the external auth)       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Features:                                                  │ │
│  │ • auth-middleware (validate external JWT tokens)           │ │
│  │ • template-api (CRUD operations)                           │ │
│  │ • batch-api (import, processing)                           │ │
│  │ • render-queue (BullMQ job management)                     │ │
│  │ • storage-proxy (SeaweedFS client for remote storage)      │ │
│  │ • subscription-sync (WebSocket client to external service) │ │
│  │ • rate-limiter (enforce subscription limits)               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │    │    Redis     │    │  Cassandra   │
│ (Normalized) │    │  (Queue +    │    │ (Canonical   │
│   (Local)    │    │   Cache)     │    │  Event Log)  │
│              │    │   (Local)    │    │   (Local)    │
└──────────────┘    └──────────────┘    └──────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       render-worker                             │
│                  (Background Job Processor)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Features:                                                  │ │
│  │ • card-renderer (Canvas/Puppeteer)                         │ │
│  │ • layout-calculator (ported from C# logic)                 │ │
│  │ • text-fitting (auto-shrink algorithm)                     │ │
│  │ • qr-generator (QR code creation)                          │ │
│  │ • export-handler (PNG/JPG with DPI settings)               │ │
│  │ • seaweedfs-uploader (client to remote SeaweedFS)          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Upload results
                              ▼
                    (Remote SeaweedFS - see External Services above)
```

### Architecture Key Points

1. **api-server** is the **internal** E-Cards application backend
   - NOT the external authentication/user management API
   - Handles E-Cards-specific operations (templates, batches, rendering)
   - Communicates with external auth API as a client

2. **External Auth & User Management API** (remote)
   - Separate service that handles authentication, user profiles, subscriptions
   - E-Cards app receives JWT tokens from this service
   - Validates user information and permissions via API calls

3. **SeaweedFS** (remote, separate build)
   - Already deployed as a separate service
   - E-Cards application connects as a client only
   - No local SeaweedFS services in this docker-compose

4. **Local Services** (in this build)
   - PostgreSQL: E-Cards application data
   - Cassandra: E-Cards event logs
   - Redis: Job queue and caching
   - front-cards: Public web interface
   - api-server: Internal backend API
   - render-worker: Background job processor
```

### Feature-Based Architecture

Each major functionality is organized as a **feature** with clear boundaries:

```
/front-cards
  /features
    /auth
      - components/
      - hooks/
      - services/
      - types.ts
    /template-designer
      - components/
      - hooks/
      - services/
      - types.ts
    /batch-import
    /batch-management
    /name-parser
    /user-profile
  /shared
    - components/
    - utils/
    - types/
```

This structure ensures:
- Clear context management per feature
- Easier code navigation and maintenance
- Isolated testing and development
- Reusable shared components

---

## Domain Models

### Core Entities

#### 1. User
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

#### 2. Template
```typescript
type Template = {
  id: string;
  userId: string;
  name: string;
  description?: string;
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

#### 3. Batch
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

#### 4. CanonicalStaff (Individual Record)
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

#### 5. RenderJob
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

## Features

**Note**: Detailed specifications in `.claude/features/`. Read on-demand, not all at once.

### Feature Summary

| Feature | Priority | Status | Spec File |
|---------|----------|--------|-----------|
| **Auto-Auth** | HIGH | In Progress | `.claude/features/auto-auth.md` |
| **Database Setup** | HIGH | Planned | `.claude/features/database-setup.md` |
| **Template Designer** | HIGH | Planned | `.claude/features/template-designer.md` |
| **Batch Import** | HIGH | Planned | `.claude/features/batch-import.md` |
| **Render Worker** | HIGH | Planned | `.claude/features/render-worker.md` |
| **Batch Management** | MEDIUM | Planned | `.claude/features/batch-management.md` |
| **Name Parser** | MEDIUM | Planned | `.claude/features/name-parser.md` |
| **User Profile** | LOW | Planned | `.claude/features/user-profile.md` |

**Implementation Order**: See `.claude/features/feature-order.md`

### Core Features Brief

**Auto-Auth (OAuth 2.0 + PKCE)**
- Seamless SSO from epicdev.com/app
- Integrates with User App (OAuth) and Admin API (data)
- Security: PKCE, state parameter, httpOnly cookies, encrypted refresh tokens

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
- Credit usage tracking

**Integration**:
```typescript
type NameParseRequest = {
  fullName: string;
  locale?: string; // e.g., "es-CR" for Costa Rica
};

type NameParseResponse = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  confidence: number; // 0-1
};

async function parseNameWithLLM(
  request: NameParseRequest
): Promise<NameParseResponse> {
  // Call external LLM service
  const response = await fetch(
    `${EXTERNAL_API_URL}/name-parser`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userJWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );

  if (!response.ok) {
    throw new Error('LLM parsing failed - falling back to as-is');
  }

  return response.json();
}
```

### Feature 6: User Profile (user-profile)
**Purpose**: User settings and subscription information.

**Responsibilities**:
- Display subscription tier and limits
- Show current usage (cards generated, LLM credits)
- Manage user preferences
- Font library management
- Color palette management

---

## Technical Stack

### Frontend (front-cards)
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **State Management**: React Context + Zustand (for complex features)
- **Canvas**: Fabric.js or Konva.js for template designer
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Fetch API with custom wrapper
- **WebSocket**: native WebSocket API
- **File Upload**: react-dropzone

### Backend (api-server)
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5+
- **Framework**: Fastify (high performance) or Express
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
- **Cassandra 5**: Event logs, audit trails, time-series data (high write throughput)
- **Redis 7**: Job queue, cache, session storage

### Storage
- **SeaweedFS**: Distributed object storage for:
  - Template backgrounds
  - Custom fonts
  - Generated card outputs
  - User assets (icons, logos)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (production)
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK stack

---

## Development Approach

### Feature-Based Development
All development follows a feature-based approach:

1. **Feature Identification**: Each functionality has a unique feature name
2. **Isolated Development**: Features are developed in isolation with clear interfaces
3. **Shared Resources**: Common utilities, components, and types live in `/shared`
4. **Context Management**: Each feature manages its own context/state
5. **Testing**: Each feature has its own test suite

### Feature Structure Template
```
/features/{feature-name}
  /components
    - FeatureComponent.tsx
    - FeatureComponent.test.tsx
  /hooks
    - useFeatureHook.ts
    - useFeatureHook.test.ts
  /services
    - featureService.ts
    - featureService.test.ts
  /types
    - index.ts
  /utils
    - featureUtils.ts
  index.ts (public exports)
  README.md (feature documentation)
```

### Benefits
- Clear ownership and boundaries
- Easier onboarding (developers can understand one feature at a time)
- Better testing (isolated unit tests per feature)
- Simplified context management (Claude/Codex can load feature-specific context)
- Scalable codebase (new features don't impact existing ones)

---

## External Integrations

### 1. Authentication Service
**Purpose**: Central SSO and user management

**Integration Points**:
- **Login/Logout**: Redirect to external auth page
- **JWT Validation**: Verify tokens on each API request
- **Token Refresh**: Automatic token renewal
- **User Info**: Fetch user profile and permissions

**API Endpoints**:
```
POST /auth/login → Redirect URL
POST /auth/logout
GET  /auth/user → User profile
POST /auth/refresh → New JWT
```

### 2. Subscription Service (WebSocket)
**Purpose**: Real-time subscription status and rate limits

**Integration**:
```typescript
const subscriptionWS = new WebSocket(EXTERNAL_SUBSCRIPTION_WS);

subscriptionWS.on('message', (data) => {
  const update = JSON.parse(data);

  switch (update.type) {
    case 'LIMIT_UPDATE':
      // Update user rate limits in real-time
      updateUserLimits(update.userId, update.limits);
      break;

    case 'SUBSCRIPTION_CHANGED':
      // User upgraded/downgraded
      refreshUserSubscription(update.userId);
      break;

    case 'ACCOUNT_SUSPENDED':
      // Block user operations
      suspendUserAccess(update.userId);
      break;
  }
});
```

**Message Types**:
- `LIMIT_UPDATE`: Rate limit changes
- `SUBSCRIPTION_CHANGED`: Tier upgrade/downgrade
- `ACCOUNT_SUSPENDED`: Account suspension
- `CREDIT_ADDED`: LLM credits added

### 3. User Verification API
**Purpose**: Validate user information and status

**API Endpoints**:
```
GET /users/{userId}/status → Active/Suspended/Pending
GET /users/{userId}/limits → Current usage and limits
POST /users/{userId}/verify → Verify user identity
```

### 4. LLM Name Parser API
**Purpose**: Intelligent name field parsing

**API Endpoint**:
```
POST /llm/parse-name
Request: {
  fullName: string;
  locale?: string;
  context?: string;
}
Response: {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  confidence: number;
  creditsUsed: number;
}
```

### 5. SeaweedFS (Bucket Storage)
**Purpose**: Distributed file storage

**S3-Compatible API**:
```typescript
// Upload file
PUT /users/{userId}/templates/{templateId}/background.png

// Download file
GET /users/{userId}/batches/{batchId}/cards/{recordId}.png

// List files
GET /users/{userId}/batches/{batchId}/?prefix=cards/

// Delete file
DELETE /users/{userId}/templates/{templateId}/background.png
```

**Directory Structure**:
```
/users
  /{userId}
    /templates
      /{templateId}
        /background.png
        /fonts
          /custom-font.ttf
    /batches
      /{batchId}
        /cards
          /{recordId}.png
        /archive.zip
    /assets
      /icons
      /logos
```

---

## Data Flow

### Template Creation Flow
```
1. User uploads background → Front-cards
2. Front-cards → API Server: POST /api/templates (multipart)
3. API Server → SeaweedFS: Upload background image
4. API Server → PostgreSQL: Store template metadata
5. API Server → Front-cards: Template ID + background URL
6. User adds elements → Front-cards (local state)
7. User saves template → Front-cards
8. Front-cards → API Server: PUT /api/templates/{id}
9. API Server → PostgreSQL: Update template JSON
10. API Server → Front-cards: Success response
```

### Batch Import & Generation Flow
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
      → Call external LLM API
      → Deduct credits
      → Parse name into fields
   c. If credits = 0:
      → Save fullName as-is
      → Leave firstName/lastName undefined
5. Return parsed CanonicalStaff record
```

### Subscription Sync Flow
```
1. API Server connects to external WebSocket
2. Subscribe to user channels
3. Receive real-time updates:
   - Rate limit changes
   - Subscription tier changes
   - Account suspension
4. Update local cache (Redis)
5. Enforce limits on next API call
6. Notify user via WebSocket (if connected)
```

---

## Implementation Stages

### Stage 1: Project Setup & Infrastructure (Week 1)
**Goals**: Establish development environment and core infrastructure

**Tasks**:
- [x] Initialize repositories (monorepo structure)
- [x] Set up Docker Compose for local development
- [x] Configure PostgreSQL with initial schema
- [x] Configure Cassandra keyspace
- [x] Set up SeaweedFS with S3 gateway
- [ ] Create base Next.js application structure
- [ ] Create base API server structure
- [ ] Create base render worker structure
- [ ] Set up shared TypeScript types package
- [ ] Configure ESLint, Prettier, and TypeScript

**Deliverables**:
- Working local development environment
- All services running in Docker
- Basic Hello World endpoints

### Stage 2: Authentication & User Management (Week 2)
**Goals**: Implement auth integration and user session management

**Tasks**:
- [ ] JWT middleware for API server
- [ ] Auth context provider in front-cards
- [ ] Protected route wrapper component
- [ ] Login/logout flow integration
- [ ] User profile API endpoints
- [ ] Subscription WebSocket client
- [ ] Rate limiting middleware
- [ ] PostgreSQL user schema and migrations

**Deliverables**:
- Working SSO integration
- Protected application routes
- Real-time subscription updates

### Stage 3: Core Domain Models & Database (Week 3)
**Goals**: Implement database schemas and domain models

**Tasks**:
- [ ] Prisma schema for all entities
- [ ] Database migrations
- [ ] Cassandra schema for event logging
- [ ] TypeScript type definitions
- [ ] Repository pattern implementations
- [ ] Seed data for development
- [ ] Unit tests for repositories

**Deliverables**:
- Complete database schema
- CRUD operations for all entities
- Comprehensive TypeScript types

### Stage 4: C# Logic Porting (Week 4)
**Goals**: Port legacy C# parsing and layout logic to TypeScript

**Tasks**:
- [ ] Port NameParser logic
- [ ] Port ValidateString, ToTitleCaseCorrect
- [ ] Port phone number formatting (Costa Rican format)
- [ ] Port CalculateLayout logic
- [ ] Port GetEmailClean for file naming
- [ ] Implement phone vs extension detection
- [ ] Unit tests for all ported functions
- [ ] Integration tests with sample data

**Deliverables**:
- TypeScript versions of all C# utilities
- 100% test coverage
- Validated against legacy output

### Stage 5: Template Designer Feature (Week 5-6)
**Goals**: Build visual template editor

**Tasks**:
- [ ] Canvas component with Fabric.js/Konva
- [ ] Element toolbar (text, image, QR)
- [ ] Drag-and-drop functionality
- [ ] Property panel for element editing
- [ ] Background image upload
- [ ] Font upload and management
- [ ] Color palette management
- [ ] Auto-fit text configuration UI
- [ ] Per-word color rule configuration
- [ ] Dynamic icon positioning setup
- [ ] Template save/load API
- [ ] Template library browser

**Deliverables**:
- Fully functional template designer
- Template CRUD operations
- User can create and save templates

### Stage 6: Batch Import Feature (Week 7-8)
**Goals**: Build data import and parsing

**Tasks**:
- [ ] Excel file upload component
- [ ] XLSX parsing with xlsx library
- [ ] Text paste parsing with heuristics
- [ ] Field mapping UI
- [ ] Name parser integration
- [ ] LLM credit check and deduction
- [ ] Phone vs extension parsing
- [ ] Data validation and error handling
- [ ] Import preview component
- [ ] Batch creation API endpoints
- [ ] Staff record creation with layout calculation

**Deliverables**:
- Working import wizard
- Intelligent name parsing
- Validated staff records with layouts

### Stage 7: Batch Management Feature (Week 9)
**Goals**: Build batch viewing and management

**Tasks**:
- [ ] Batch list view with filters
- [ ] Batch detail view
- [ ] Individual record preview
- [ ] Card preview modal
- [ ] Regenerate failed cards
- [ ] Download single card
- [ ] Download batch as ZIP
- [ ] Delete batch
- [ ] Batch statistics dashboard

**Deliverables**:
- Complete batch management UI
- Preview and download functionality

### Stage 8: Render Worker (Week 10-11)
**Goals**: Build background card rendering engine

**Tasks**:
- [ ] BullMQ job processor setup
- [ ] Canvas rendering with node-canvas or Puppeteer
- [ ] Background image loading
- [ ] Text rendering with auto-fit algorithm
- [ ] Multi-color text (first word vs rest)
- [ ] Right edge calculation for text
- [ ] Dynamic "In" icon positioning
- [ ] Icon visibility logic
- [ ] QR code generation
- [ ] PNG/JPG export with DPI settings
- [ ] SeaweedFS upload
- [ ] Job status updates
- [ ] Progress WebSocket emissions
- [ ] Error handling and retry logic

**Deliverables**:
- Working render pipeline
- High-quality card exports
- Real-time progress updates

### Stage 9: SeaweedFS Integration (Week 12)
**Goals**: Implement distributed file storage

**Tasks**:
- [ ] S3-compatible client setup
- [ ] File upload service
- [ ] File download service
- [ ] File deletion service
- [ ] URL generation for public access
- [ ] Multi-part upload for large files
- [ ] ZIP archive creation for batch downloads
- [ ] Storage quota management
- [ ] Cleanup of old files

**Deliverables**:
- Complete SeaweedFS integration
- Reliable file operations
- Efficient bulk downloads

### Stage 10: External API Integrations (Week 13)
**Goals**: Connect to all external services

**Tasks**:
- [ ] Auth service integration (complete)
- [ ] Subscription WebSocket (complete)
- [ ] User verification API client
- [ ] LLM name parser API client
- [ ] Credit tracking and deduction
- [ ] Error handling for external failures
- [ ] Fallback mechanisms
- [ ] Integration tests with mocked services

**Deliverables**:
- All external integrations working
- Graceful degradation on failures

### Stage 11: Testing & Quality Assurance (Week 14)
**Goals**: Comprehensive testing

**Tasks**:
- [ ] Unit tests for all features (80%+ coverage)
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical user flows
- [ ] Performance testing (batch rendering)
- [ ] Load testing (concurrent users)
- [ ] Security audit (SQL injection, XSS, etc.)
- [ ] Accessibility audit (WCAG 2.1)
- [ ] Browser compatibility testing

**Deliverables**:
- Comprehensive test suite
- Performance benchmarks
- Security report

### Stage 12: Polish & Documentation (Week 15-16)
**Goals**: User experience refinement and documentation

**Tasks**:
- [ ] Error message improvements
- [ ] Loading states and animations
- [ ] Empty states and onboarding
- [ ] Help documentation
- [ ] Video tutorials
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Developer guide
- [ ] Deployment guide
- [ ] User manual

**Deliverables**:
- Production-ready application
- Complete documentation
- Training materials

---

## Legacy System Preservation

### InDesign JSX Script Behavior
The legacy system uses `GenerateCardsBvars.jsx` with specific behaviors that must be preserved:

#### 1. Record Structure
```javascript
// Legacy record object
{
  Name: "Pilo",
  LastName: "Cantor Jimente",
  Position: "Senior Developer",
  Texto1: "Code Digital Group",
  Texto2: "www.codedg.com",
  Texto3: "San José, Costa Rica",
  PhoneX: 100,
  PhoneY: 200,
  PhoneShow: true,
  WhaX: 150,
  WhaY: 200,
  WhatsappShow: true,
  WebX: 200,
  WebY: 200,
  WebShow: true,
  InY: 50,
  FileName: "pilo_cantor_jimente_abc123"
}
```

#### 2. Named InDesign Objects
- Text frames: `"Nombre"`, `"Cargo"`, `"Texto1"`, `"Texto2"`, `"Texto3"`
- Images: `"In"`, `"Phone"`, `"Whatsapp"`, `"Web"`

#### 3. Brand Colors & Per-Word Styling
```javascript
// Name frame: "Pilo Cantor Jimente"
// Characters 0-3 (length of "Pilo") → CodeBlue
// Characters 4-end → Black
```

Our template system must replicate this with `styleRules`:
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

#### 4. Auto-Fit Text Algorithm
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

Our renderer must implement equivalent logic:
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

#### 5. Dynamic "In" Icon Positioning
```javascript
var InXLimit = Math.max(
  getTextRightEdge(nameFrame),
  getTextRightEdge(positionFrame)
) + 4;

InXLimit = Math.max(487.8415, Math.min(InXLimit, 506.91));

inImage.move([InXLimit, record.InY]);
```

Our template must support:
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

#### 6. Export Settings
```javascript
pngOptions.exportResolution = 144;
pngOptions.pngQuality = PNGQuality.MAXIMUM;
pngOptions.antiAlias = true;
pngOptions.useDocumentBleeds = false;
```

Our renderer:
```typescript
{
  exportDpi: 144, // or 300 for higher quality
  quality: 100,
  antiAlias: true,
  bleed: false
}
```

---

## Configuration Files

### Environment Variables

#### front-cards (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

#### api-server (.env)
```bash
NODE_ENV=development
PORT=4000

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ecards_db
POSTGRES_USER=ecards_user
POSTGRES_PASSWORD=ecards_dev_password

# Cassandra
CASSANDRA_HOSTS=localhost
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=ecards_canonical
CASSANDRA_DC=dc1

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# SeaweedFS (Remote - Client Configuration)
# This connects to a remote SeaweedFS instance (separate deployment)
SEAWEEDFS_ENDPOINT=http://remote-seaweedfs-host:8888
SEAWEEDFS_ACCESS_KEY=your_seaweedfs_access_key
SEAWEEDFS_SECRET_KEY=your_seaweedfs_secret_key
SEAWEEDFS_BUCKET=ecards

# JWT (for internal session tokens, NOT external auth)
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRY=7d

# LLM Configuration (Name Parsing)
LLM_ENABLED=true
LLM_PRIMARY_PROVIDER=openai          # openai | anthropic | deepseek | external
LLM_FALLBACK_PROVIDER=deepseek       # openai | anthropic | deepseek | external | none
LLM_CREDIT_COST=1                    # Flat rate: 1 credit per call
LLM_RETRY_ATTEMPTS=2
LLM_TIMEOUT_MS=10000

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini             # gpt-4o-mini | gpt-4o | gpt-3.5-turbo
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_MAX_TOKENS=500
ANTHROPIC_TEMPERATURE=0.3

# DeepSeek Configuration
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
DEEPSEEK_MODEL=deepseek-chat         # deepseek-chat | deepseek-coder
DEEPSEEK_MAX_TOKENS=500
DEEPSEEK_TEMPERATURE=0.3

# External LLM Service (Backward Compatibility)
EXTERNAL_LLM_API=http://remote-llm-server:5000/api/llm

# External Services (Remote APIs)
# External Auth & User Management API (NOT this api-server)
EXTERNAL_AUTH_URL=http://remote-auth-server:5000
EXTERNAL_SUBSCRIPTION_WS=ws://remote-auth-server:5000/ws
EXTERNAL_USER_API=http://remote-auth-server:5000/api/users

# Rate Limiting
RATE_LIMIT_FREE_TIER=100
RATE_LIMIT_BASIC_TIER=1000
RATE_LIMIT_PRO_TIER=10000
RATE_LIMIT_ENTERPRISE_TIER=100000
```

#### render-worker (.env)
```bash
# Same as api-server, plus:
WORKER_CONCURRENCY=4
WORKER_MAX_ATTEMPTS=3
WORKER_TIMEOUT=60000
RENDER_ENGINE=puppeteer # or 'node-canvas'
```

---

## LLM Configuration & Provider Strategy

### Overview

The E-Cards application uses LLM (Large Language Model) services for intelligent name parsing, particularly useful for Costa Rican and Latin American naming conventions where names may have multiple parts (first, middle, last, second-last names).

### Supported Providers

1. **OpenAI** (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
2. **Anthropic** (Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus)
3. **DeepSeek** (deepseek-chat, deepseek-coder)
4. **External** (Custom LLM API endpoint - backward compatibility)

### Provider Selection Strategy

**Primary + Fallback Pattern:**
- All users use the same configured primary provider
- If primary provider fails or times out, fallback provider is used automatically
- If both fail, name is saved as `fullName` only (confidence = 0)

**Configuration:**
```typescript
LLM_PRIMARY_PROVIDER=openai      // First attempt
LLM_FALLBACK_PROVIDER=deepseek   // Automatic fallback
LLM_RETRY_ATTEMPTS=2             // Retries per provider
LLM_TIMEOUT_MS=10000             // 10 seconds timeout
```

### Credit System

**Flat Rate Model:**
- Every LLM call costs exactly **1 credit**, regardless of provider or model
- Credits are checked and deducted BEFORE making the LLM call
- If user has 0 credits, name parsing is skipped (saves as `fullName` only)

**Credit Flow:**
1. User uploads batch with `useLLMParsing: true`
2. System checks user's `llmCredits` balance
3. If credits available:
   - Deduct 1 credit
   - Call LLM (primary or fallback)
   - Return parsed name components
4. If no credits:
   - Skip LLM call
   - Save as `fullName` only
   - Return confidence = 0

### Use Cases

**Primary Use Case: Name Parsing**

Input:
```typescript
{
  fullName: "Juan Carlos López Martínez",
  locale: "es-CR"  // Costa Rica
}
```

LLM Output:
```typescript
{
  firstName: "Juan Carlos",
  lastName: "López",
  secondLastName: "Martínez",
  confidence: 0.95,
  creditsUsed: 1
}
```

**Edge Cases:**
- Single word name: `fullName = "Madonna"` → firstName only
- Two words: `firstName + lastName`
- Three words: `firstName + lastName + secondLastName`
- Four+ words: LLM determines best split

### Provider Configuration Examples

**Development (.env.dev.example):**
```bash
LLM_ENABLED=true
LLM_PRIMARY_PROVIDER=openai
LLM_FALLBACK_PROVIDER=deepseek

OPENAI_API_KEY=sk-proj-dev-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3

DEEPSEEK_API_KEY=sk-dev-key-here
DEEPSEEK_MODEL=deepseek-chat
```

**Production (.env.prod):**
```bash
LLM_ENABLED=true
LLM_PRIMARY_PROVIDER=anthropic
LLM_FALLBACK_PROVIDER=openai

ANTHROPIC_API_KEY=${SECRET_ANTHROPIC_KEY}
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

OPENAI_API_KEY=${SECRET_OPENAI_KEY}
OPENAI_MODEL=gpt-4o-mini
```

### Provider Characteristics

| Provider | Speed | Cost | Accuracy | Best For |
|----------|-------|------|----------|----------|
| GPT-4o-mini | Fast | Low | Good | High volume, dev |
| GPT-4o | Medium | Medium | Excellent | Production |
| Claude Sonnet | Medium | High | Excellent | Complex names |
| Claude Haiku | Very Fast | Low | Good | High volume |
| DeepSeek | Fast | Very Low | Good | Cost optimization |
| External | Varies | Varies | Varies | Custom models |

### Error Handling & Fallbacks

**Scenario 1: Primary Provider Fails**
```
1. Try primary provider (OpenAI)
2. Timeout or error → Retry (LLM_RETRY_ATTEMPTS)
3. Still fails → Try fallback provider (DeepSeek)
4. Fallback succeeds → Return parsed name
```

**Scenario 2: Both Providers Fail**
```
1. Primary fails after retries
2. Fallback fails after retries
3. Log error
4. Return { fullName: original, confidence: 0 }
5. User sees name but not parsed
```

**Scenario 3: No Credits**
```
1. Check user.llmCredits
2. If 0 → Skip LLM entirely
3. Return { fullName: original, confidence: 0 }
4. No API calls made
```

### Security Considerations

**API Key Management:**
- Never commit API keys to version control
- Use environment variables or Docker secrets
- Rotate keys regularly (every 90 days)
- Monitor API usage for anomalies

**Rate Limiting:**
- Implement per-user limits on LLM calls
- Prevent API key abuse
- Track costs per user/organization

**Data Privacy:**
- Names are sent to external LLM providers
- Ensure compliance with GDPR, CCPA
- Consider on-premise LLM for sensitive data
- Add user consent for LLM processing

### Future Enhancements

**Not Implemented (Future Work):**
- Per-user provider selection
- Dynamic model selection based on complexity
- Token-based cost tracking
- LLM response caching
- Multi-language optimization
- Confidence-based retry logic
- A/B testing between providers

---

## Security Considerations

### Authentication & Authorization
- All API endpoints require valid JWT
- Token expiry and refresh mechanisms
- Role-based access control (RBAC)
- User isolation (cannot access other users' data)

### Input Validation
- Zod schemas for all API inputs
- File upload validation (type, size, malware scan)
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (sanitize user inputs)

### Rate Limiting
- Per-user rate limits based on subscription
- DDoS protection with exponential backoff
- Queue priority for paid users

### Data Privacy
- Encrypted passwords (bcrypt)
- Secure token storage (httpOnly cookies)
- GDPR compliance (data export, deletion)
- Audit logs in Cassandra

### File Storage Security
- Signed URLs for SeaweedFS downloads
- Private buckets by default
- Virus scanning on uploads
- Size limits per user tier

---

## Monitoring & Observability

### Logging
- Structured logs with Winston
- Log levels: ERROR, WARN, INFO, DEBUG
- Centralized logging with ELK stack
- Request/response logging
- Error tracking with Sentry

### Metrics
- Prometheus metrics collection
- Grafana dashboards
- Key metrics:
  - API response times
  - Render job duration
  - Queue depth
  - Database query performance
  - SeaweedFS upload/download times
  - Error rates

### Alerts
- High error rate (>5%)
- Queue backup (>1000 jobs)
- Database connection failures
- SeaweedFS unavailability
- External service downtime

---

## Performance Targets

### API Server
- p95 response time: <200ms
- p99 response time: <500ms
- Throughput: 1000 req/s
- Concurrent connections: 10,000

### Render Worker
- Single card render: <2s
- Batch of 100 cards: <3 minutes
- Concurrent jobs: 20 per worker instance

### Database
- PostgreSQL query time: <50ms (p95)
- Cassandra write time: <10ms (p95)
- Redis operations: <1ms (p99)

### Storage (Remote SeaweedFS)
- File upload: <1s for 5MB file
- File download: <500ms for 5MB file
- Network latency to remote SeaweedFS: <50ms

---

## Disaster Recovery

### Backup Strategy
- PostgreSQL: Daily full backup + WAL archiving
- Cassandra: Incremental snapshots every 6 hours
- SeaweedFS: Managed by remote SeaweedFS deployment (replication factor 3)

### Recovery Plan
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 15 minutes
- Automated failover for critical services
- Documented recovery procedures

---

## .claude Folder Structure

The `.claude` folder is used by Claude Code for project-specific context, commands, and memory. This section documents the proper organization and usage of this folder.

### Overview

The `.claude` directory stores team-shared project information that helps Claude Code understand the project better and provides quick access to common workflows.

### Directory Structure

```
.claude/
├── CLAUDE.md              # Project memory and team-shared instructions (optional)
├── SESSION_STARTERS.md    # Quick-start prompts for different types of sessions
└── commands/              # Project-specific slash commands
    ├── feature/           # Feature-related commands (organized by subdirectory)
    │   ├── new.md         # /new command - Create a new feature
    │   ├── test.md        # /test command - Run tests for a feature
    │   └── deploy.md      # /deploy command - Deploy a feature
    ├── db/                # Database-related commands
    │   ├── migrate.md     # /migrate command - Run database migrations
    │   └── seed.md        # /seed command - Seed database with test data
    └── docker/            # Docker-related commands
        ├── up.md          # /up command - Start docker services
        └── logs.md        # /logs command - View docker logs
```

### File Purposes

#### 1. CLAUDE.md (Optional)
**Purpose**: Team-shared project memory and instructions

**Should contain**:
- Project architecture overview
- Coding standards and style guidelines
- Common build/test/deploy commands
- Project-specific conventions
- Links to important documentation

**Example content**:
```markdown
# E-Cards Project Memory

## Architecture
This is a feature-based Next.js 16 application...

## Coding Standards
- Use TypeScript strict mode
- Follow feature-based organization
- All features must have tests

## Common Commands
- Build: `npm run build`
- Test: `npm test`
- Dev: `npm run dev`
```

**Note**: CLAUDE.md is automatically loaded by Claude Code at the start of each session.

#### 2. SESSION_STARTERS.md
**Purpose**: Provide quick-start prompts for different types of work sessions

**Should contain**:
- General project session starter
- Feature-specific session starters
- Bug fix session templates
- Database work session templates
- Deployment session templates

**How to use**: Developers copy the relevant section and paste it when starting a new Claude Code session to quickly load the right context.

#### 3. commands/ Directory
**Purpose**: Store project-specific slash commands

**Organization**:
- Commands can be in the root of `commands/` or in subdirectories for organization
- Subdirectories are for organization only and appear in command descriptions
- The command name is the filename without `.md` extension
- Commands are invoked with `/command-name` regardless of subdirectory

**Command File Format**:
```markdown
---
description: Short description of what this command does
allowedTools: [Read, Write, Edit, Bash]  # Optional: restrict tools
---

# Command Instructions

When this command is invoked, Claude Code will:
1. Do this
2. Then do that
3. Finally do this

The instructions can reference the current directory, files, etc.
```

**Example**: `.claude/commands/feature/new.md`
```markdown
---
description: Create a new feature with proper structure
allowedTools: [Write, Bash, Edit]
---

Create a new feature with the following structure:

1. Ask the user for the feature name
2. Create `/front-cards/features/{feature-name}/` directory
3. Create subdirectories: components/, hooks/, services/, types/
4. Create index.ts that exports public API
5. Create README.md documenting the feature
6. Add the feature to the main features index
```

When invoked with `/new`, Claude Code will execute these instructions.

### User-Level vs Project-Level

Claude Code supports two levels of `.claude` configuration:

1. **Project-level** (this repository)
   - Location: `D:\Projects\EPIC\tools-ecards\.claude\`
   - Shared with team via git
   - Contains project-specific commands and context

2. **User-level** (personal)
   - Location: `~/.claude/` (user's home directory)
   - Personal preferences and commands
   - NOT checked into git
   - Applies across all projects

### Best Practices

1. **Keep CLAUDE.md updated**: When major architectural changes occur, update CLAUDE.md
2. **Document common workflows as commands**: If you find yourself doing the same multi-step task repeatedly, create a slash command for it
3. **Use SESSION_STARTERS.md actively**: Start each session by copying the relevant template
4. **Organize commands logically**: Use subdirectories (feature/, db/, docker/) to group related commands
5. **Version control**: Commit `.claude/` to git so the team shares the same context
6. **Avoid secrets**: Never put API keys, passwords, or other secrets in `.claude/` files

### Current Project Structure

For this E-Cards project, we have:

```
.claude/
└── SESSION_STARTERS.md    # Quick-start prompts for different work sessions
```

**Planned additions**:
- `commands/feature/new.md` - Create new feature with proper structure
- `commands/db/migrate.md` - Run database migrations
- `commands/docker/up.md` - Start development environment
- `commands/test/feature.md` - Run tests for a specific feature

### Integration with Development Workflow

The `.claude` folder integrates with the feature-based development approach:

1. **Starting work on a feature**: Use SESSION_STARTERS.md to load feature-specific context
2. **Creating a new feature**: Use `/new` command (once created) to scaffold feature structure
3. **Running tests**: Use feature-specific slash commands
4. **Context management**: Claude Code automatically loads CLAUDE.md, providing consistent context

This ensures efficient context management and faster development cycles.

---

## Conclusion

This context document provides a comprehensive overview of the E-Cards System project. It should serve as the primary reference for:

- New developers joining the project
- AI assistants (Claude/Codex) when working on features
- Project stakeholders understanding the system
- Future maintenance and enhancements

For feature-specific details, refer to individual feature README files in `/features/{feature-name}/README.md`.

For quick session startup, see `.claude/SESSION_STARTERS.md`.
