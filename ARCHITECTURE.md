# E-Cards System - Feature-Centered Architecture

## Project Scope

Build an **E-Cards/QR-Code Designer** application supporting:
1. **Template Design** - Visual editor for card layouts with text, images, and QR codes
2. **Batch Import** - Excel/text parsing with LLM-assisted name field extraction
3. **Background Rendering** - Scalable card generation with InDesign-equivalent quality

**Critical Constraints:**
- Feature-based architecture consistently implemented across all services
- Real-time progress updates via WebSocket
- Integration with external auth, subscription, and storage services
- Preserve legacy InDesign layout behavior

**Target Platform:** Web (Next.js 16 frontend)

---

## Wireframe Overview

### 1. Login View
**Layout:**
- **Header**: Logo, application title
- **Content**: SSO redirect button → External auth service
- **Footer**: Version info, help link

**Navigation:** Login → Dashboard (on successful auth)

### 2. Dashboard View
**Layout:**
- **Header**: User profile dropdown, notifications
- **Sidebar**: Navigation (Templates, Batches, Settings)
- **Content**:
  - Recent batches widget (list with status)
  - Quick actions (New Template, New Batch)
  - Usage statistics (cards remaining, LLM credits)
- **Modal**: None initially

**Data Requirements:**
- User profile (name, email, subscription tier)
- Recent batches (id, name, status, progress)
- Usage limits (current/max cards, credits)

**Navigation:** Dashboard → Template Designer | Batch Import | Batch Detail

### 3. Template Designer View
**Layout:**
- **Header**: Template name input, Save/Cancel buttons
- **Toolbar**: Element tools (Text, Image, QR)
- **Canvas Area**: Drag-drop editor with background and elements
- **Properties Panel**: Element-specific settings (font, color, position, auto-fit rules)
- **Preview Panel**: Live preview with mock data

**Data Requirements:**
- Template metadata (name, dimensions, DPI)
- Element list (type, position, properties)
- Background image (SeaweedFS URL)
- Mock staff record for preview

**Responsive:** Desktop-only (canvas requires precision)

**Navigation:** Designer → Dashboard | Save → Template List

### 4. Batch Import View
**Layout:**
- **Wizard Steps**: File Upload → Field Mapping → Preview → Confirm
- **Step 1 - Upload**:
  - File drop zone (Excel/text)
  - Parsed data table preview
- **Step 2 - Mapping**:
  - Column-to-field mapping UI
  - LLM parsing toggle (with credits indicator)
- **Step 3 - Preview**:
  - Sample card previews (first 3 records)
  - Validation warnings
- **Step 4 - Confirm**:
  - Batch name input
  - Template selector
  - Submit button

**Data Requirements:**
- Uploaded file data (rows/columns)
- Available templates (id, name, thumbnail)
- Field mapping configuration
- LLM credit balance

**Navigation:** Import → Batch Detail (on submit)

### 5. Batch Detail View
**Layout:**
- **Header**: Batch name, status badge, action buttons (Download, Delete)
- **Progress Bar**: Overall completion percentage
- **Records Table**:
  - Columns: Name, Status, Preview, Actions
  - Row actions: View, Regenerate, Download
- **Preview Modal**: Full card preview on click

**Data Requirements:**
- Batch metadata (name, total/processed/failed counts)
- Record list (id, name, status, preview URL)
- Real-time progress updates (WebSocket)

**Navigation:** Detail → Card Preview Modal | Download

---

## Folder Structure

### Monorepo Structure

```
/tools-ecards
├── .claude/                      # Claude Code context
│   ├── SESSION_STARTERS.md       # Session templates
│   └── commands/                 # Project slash commands
│       ├── feature/
│       │   └── new.md            # /new - Scaffold feature
│       └── docker/
│           └── up.md             # /up - Start services
├── .github/
│   └── workflows/
│       └── ci.yml                # TODO: CI pipeline stub
├── packages/
│   └── shared-types/             # Shared TypeScript types
│       ├── package.json
│       ├── src/
│       │   ├── domain/           # Domain models
│       │   │   ├── user.ts
│       │   │   ├── template.ts
│       │   │   ├── batch.ts
│       │   │   └── index.ts
│       │   ├── api/              # API contracts
│       │   │   ├── requests.ts
│       │   │   ├── responses.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       └── tsconfig.json
├── front-cards/                  # Next.js 16 frontend
│   ├── app/                      # Next.js app directory
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard
│   │   └── (auth)/               # Route group
│   │       └── login/
│   │           └── page.tsx
│   ├── features/                 # Feature modules
│   │   ├── auth/
│   │   ├── template-designer/
│   │   ├── batch-import/
│   │   ├── batch-management/
│   │   └── name-parser/
│   ├── shared/                   # Shared utilities
│   │   ├── components/           # Reusable UI components
│   │   ├── hooks/                # Reusable React hooks
│   │   ├── lib/                  # Utilities
│   │   └── types/                # Frontend-specific types
│   ├── public/
│   ├── Dockerfile.dev
│   ├── package.json
│   └── tsconfig.json
├── api-server/                   # Internal backend API
│   ├── src/
│   │   ├── features/             # Feature modules
│   │   │   ├── auth/
│   │   │   ├── templates/
│   │   │   ├── batches/
│   │   │   └── rendering/
│   │   ├── core/                 # Cross-cutting concerns
│   │   │   ├── config/           # Environment config
│   │   │   ├── database/         # DB connections
│   │   │   ├── middleware/       # Express middleware
│   │   │   └── websocket/        # WebSocket server
│   │   ├── shared/               # Shared utilities
│   │   │   ├── errors/           # Error handling
│   │   │   ├── validation/       # Input validation
│   │   │   └── utils/            # Helper functions
│   │   ├── app.ts                # Express app setup
│   │   └── server.ts             # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── tests/                    # Test files mirror src/
│   ├── Dockerfile.dev
│   ├── package.json
│   └── tsconfig.json
├── render-worker/                # Background job processor
│   ├── src/
│   │   ├── features/             # Feature modules
│   │   │   ├── card-renderer/
│   │   │   ├── layout-calculator/
│   │   │   └── qr-generator/
│   │   ├── core/                 # Cross-cutting concerns
│   │   │   ├── config/
│   │   │   ├── database/
│   │   │   └── queue/            # BullMQ setup
│   │   ├── shared/               # Shared utilities
│   │   │   ├── canvas/           # Canvas utilities
│   │   │   └── storage/          # SeaweedFS client
│   │   ├── worker.ts             # BullMQ worker entry
│   │   └── jobs/                 # Job handlers
│   │       └── render-card.ts
│   ├── tests/
│   ├── Dockerfile.dev
│   ├── package.json
│   └── tsconfig.json
├── db/
│   ├── init-postgres/            # PostgreSQL init scripts
│   └── init-cassandra/           # Cassandra init scripts
├── docker-compose.dev.yml
├── CONTEXT.md                    # Project documentation
├── ARCHITECTURE.md               # This file
├── README.md
└── package.json                  # Root workspace config
```

---

## Feature Module Structure (Standard Template)

Every feature follows this consistent structure across all services:

### Frontend Feature Template (`/front-cards/features/{feature-name}/`)

```
{feature-name}/
├── components/                   # Feature-specific UI components
│   ├── FeatureComponent.tsx
│   └── FeatureComponent.test.tsx
├── hooks/                        # Feature-specific React hooks
│   ├── useFeatureData.ts
│   └── useFeatureData.test.ts
├── services/                     # API client for this feature
│   ├── featureService.ts         # MOCK: API calls
│   └── featureService.test.ts
├── types/                        # Feature-specific types
│   └── index.ts
├── index.ts                      # Public exports
└── README.md                     # Feature documentation
```

**Key Files:**

**`index.ts`** - Public API
```typescript
// Public exports only - internal implementation hidden
export { FeatureComponent } from './components/FeatureComponent';
export { useFeatureData } from './hooks/useFeatureData';
export type { FeatureData, FeatureConfig } from './types';
```

**`services/featureService.ts`** - API Client
```typescript
// MOCK: Replace with actual API calls
import type { FeatureData } from '../types';

export const featureService = {
  async fetchData(id: string): Promise<FeatureData> {
    // TODO [frontend]: Connect to api-server
    await new Promise(resolve => setTimeout(resolve, 800)); // MOCK delay
    return MOCK_DATA; // See types/mocks.ts
  },

  async createItem(data: CreateFeatureRequest): Promise<FeatureData> {
    // TODO [frontend]: POST /api/feature
    throw new Error('Not implemented');
  }
};
```

**`README.md`** - Feature Documentation
```markdown
# {Feature Name}

## Purpose
Brief description of what this feature does.

## Components
- `FeatureComponent` - Main UI component

## Hooks
- `useFeatureData` - Fetch and manage feature data

## API Dependencies
- `GET /api/feature/:id` - Fetch data
- `POST /api/feature` - Create item

## Mock Data
See `types/mocks.ts` for mock data structures.
```

### Backend Feature Template (`/api-server/src/features/{feature-name}/`)

```
{feature-name}/
├── controllers/                  # Request handlers
│   ├── featureController.ts
│   └── featureController.test.ts
├── services/                     # Business logic
│   ├── featureService.ts         # MOCK: Core logic
│   └── featureService.test.ts
├── repositories/                 # Data access
│   ├── featureRepository.ts      # MOCK: Database queries
│   └── featureRepository.test.ts
├── validators/                   # Input validation
│   ├── featureValidators.ts
│   └── featureValidators.test.ts
├── routes.ts                     # Express routes
├── types.ts                      # Feature-specific types
└── README.md                     # Feature documentation
```

**Key Files:**

**`routes.ts`** - Route Definitions
```typescript
import { Router } from 'express';
import { featureController } from './controllers/featureController';
import { validateRequest } from '@/core/middleware/validation';
import { featureValidators } from './validators/featureValidators';

const router = Router();

// GET /api/feature/:id
router.get(
  '/:id',
  validateRequest(featureValidators.getById),
  featureController.getById
);

// POST /api/feature
router.post(
  '/',
  validateRequest(featureValidators.create),
  featureController.create
);

export { router as featureRoutes };
```

**`controllers/featureController.ts`** - Request Handler
```typescript
import type { Request, Response, NextFunction } from 'express';
import { featureService } from '../services/featureService';

export const featureController = {
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await featureService.getById(id);
      res.json(data);
    } catch (error) {
      next(error); // Error middleware handles it
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO [backend]: Implement creation logic
      throw new Error('Not implemented');
    } catch (error) {
      next(error);
    }
  }
};
```

**`services/featureService.ts`** - Business Logic
```typescript
// MOCK: Core business logic
import { featureRepository } from '../repositories/featureRepository';
import type { FeatureData } from '../types';

export const featureService = {
  async getById(id: string): Promise<FeatureData> {
    // TODO [backend]: Add business logic (validation, authorization)
    return await featureRepository.findById(id);
  },

  async create(data: CreateFeatureDto): Promise<FeatureData> {
    // TODO [backend]: Implement creation
    // 1. Validate business rules
    // 2. Transform data
    // 3. Call repository
    throw new Error('Not implemented');
  }
};
```

**`repositories/featureRepository.ts`** - Data Access
```typescript
// MOCK: Database access
import { prisma } from '@/core/database/client';
import type { FeatureData } from '../types';

export const featureRepository = {
  async findById(id: string): Promise<FeatureData | null> {
    // TODO [backend]: Replace with Prisma query
    // return await prisma.feature.findUnique({ where: { id } });

    // MOCK: Simulate database delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      id,
      name: 'Mock Feature',
      createdAt: new Date()
    }; // MOCK data
  },

  async create(data: any): Promise<FeatureData> {
    // TODO [backend]: Prisma insert
    throw new Error('Not implemented');
  }
};
```

**`validators/featureValidators.ts`** - Input Validation
```typescript
import { z } from 'zod';

export const featureValidators = {
  getById: z.object({
    params: z.object({
      id: z.string().uuid('Invalid ID format')
    })
  }),

  create: z.object({
    body: z.object({
      name: z.string().min(1).max(255),
      // TODO [backend]: Add other fields
    })
  })
};
```

### Worker Feature Template (`/render-worker/src/features/{feature-name}/`)

```
{feature-name}/
├── processors/                   # Job processors
│   ├── featureProcessor.ts
│   └── featureProcessor.test.ts
├── services/                     # Core logic
│   ├── featureService.ts         # MOCK: Processing logic
│   └── featureService.test.ts
├── utils/                        # Feature-specific utilities
│   └── helpers.ts
├── types.ts
└── README.md
```

---

## Shared Types Package Structure

**Purpose:** Single source of truth for domain models and API contracts.

```
/packages/shared-types/src/
├── domain/                       # Domain models
│   ├── user.ts
│   ├── template.ts
│   ├── batch.ts
│   ├── canonical-staff.ts
│   └── index.ts
├── api/                          # API contracts
│   ├── requests/
│   │   ├── template.ts
│   │   ├── batch.ts
│   │   └── index.ts
│   ├── responses/
│   │   ├── template.ts
│   │   ├── batch.ts
│   │   └── index.ts
│   └── index.ts
├── enums/                        # Shared enumerations
│   ├── status.ts
│   ├── roles.ts
│   └── index.ts
└── index.ts                      # Package entry point
```

**Example: `domain/template.ts`**
```typescript
// Shared domain model - used across all services
export type Template = {
  id: string;
  userId: string;
  name: string;
  backgroundUrl: string;
  width: number;
  height: number;
  elements: TemplateElement[];
  exportDpi: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TemplateElement = TextElement | ImageElement | QRCodeElement;

export type TextElement = {
  id: string;
  kind: 'text';
  name: string;
  field: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  autoFit?: AutoFitConfig;
};

// ... other types
```

**Example: `api/requests/template.ts`**
```typescript
import type { TemplateElement } from '../../domain/template';

export type CreateTemplateRequest = {
  name: string;
  width: number;
  height: number;
  backgroundUrl?: string;
};

export type UpdateTemplateRequest = Partial<{
  name: string;
  elements: TemplateElement[];
  exportDpi: number;
}>;
```

---

## Mock Data Conventions

All mock data must follow these rules:

1. **Explicit Marking**: Use `// MOCK` comments
2. **Failure Simulation**: Include error cases
3. **Realistic Delays**: Simulate network latency (200-800ms)
4. **Type Safety**: Mock data must match TypeScript types

**Example: Mock Service**
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
    return {
      id,
      userId: 'mock-user-id',
      name: 'Mock Template',
      width: 1024,
      height: 768,
      elements: [], // MOCK: Empty elements
      exportDpi: 300,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
};
```

---

## Configuration Templates

### `.env.example` Template

```bash
# Node Environment
NODE_ENV=development

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ecards_db
POSTGRES_USER=ecards_user
POSTGRES_PASSWORD=change_me_in_production

# Cassandra
CASSANDRA_HOSTS=localhost
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=ecards_canonical
CASSANDRA_DC=dc1

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# SeaweedFS (Remote)
SEAWEEDFS_ENDPOINT=http://remote-seaweedfs:8888
SEAWEEDFS_ACCESS_KEY=change_me
SEAWEEDFS_SECRET_KEY=change_me
SEAWEEDFS_BUCKET=ecards

# JWT
JWT_SECRET=change_me_in_production
JWT_EXPIRY=7d

# External Services (Remote)
EXTERNAL_AUTH_URL=http://remote-auth:5000
EXTERNAL_SUBSCRIPTION_WS=ws://remote-auth:5000/ws
EXTERNAL_USER_API=http://remote-auth:5000/api/users
EXTERNAL_LLM_API=http://remote-auth:5000/api/llm

# TODO [devops]: Add production values in deployment
```

---

## Critical Implementation Rules

### 1. Feature Isolation
- Features MUST NOT import from other features
- Shared code goes in `/shared` or `packages/shared-types`
- Features communicate via services layer only

### 2. Mock Completeness
- Every service method must have mock implementation
- Mocks must demonstrate contract, not business logic
- Include `// TODO [OWNER]: [ACTION]` for real implementations

### 3. Type Safety
- All API boundaries must use shared types
- No `any` types in production code
- Use Zod for runtime validation

### 4. Error Handling
- All async functions must handle errors
- Use custom error classes (see `/shared/errors`)
- Never expose internal errors to clients

### 5. Testing
- Every feature module requires tests
- Tests must cover happy path + error cases
- Mock external dependencies

---

## Next Steps

1. **Scaffold Base Applications** (see next sections)
2. **Implement Core Features** (priority: auth, template-designer, batch-import)
3. **Connect Mock Services** to real implementations
4. **Add Integration Tests**
5. **Deploy to Staging**

---

## License

MIT - See LICENSE file for details

---

**Version:** 1.0.0
**Last Updated:** 2025-01-14
