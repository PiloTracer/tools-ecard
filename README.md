# E-Cards / QR-Code Designer

A modern, feature-centered web application for creating card templates and batch-generating personalized e-cards with QR codes. Replaces legacy C# WPF + Adobe InDesign pipeline.

## Quick Start

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Services will be available at:
# - Frontend: http://localhost:3000
# - API Server: http://localhost:4000
# - PostgreSQL: localhost:5432
# - Cassandra: localhost:9042
# - Redis: localhost:6379
```

## Project Structure

```
/tools-ecards
├── .claude/                 # Claude Code project context (READ THIS FIRST!)
│   ├── README.md            # .claude directory guide
│   ├── SESSION_STARTERS.md  # Copy-paste session templates
│   └── features/            # Feature specifications (read on-demand)
│       ├── feature-order.md # Development sequence
│       ├── auto-auth.md     # OAuth 2.0 + PKCE spec
│       └── *.md             # Other feature specs
├── packages/
│   └── shared-types/        # Shared TypeScript types
├── front-cards/             # Next.js 16 frontend
├── api-server/              # Internal Node.js backend API
├── render-worker/           # Background job processor
├── db/                      # Database initialization scripts
├── docker-compose.dev.yml   # Local development environment
├── DOCS_CONTEXT.md               # Project overview (concise)
├── ARCHITECTURE.md          # Feature-centered architecture
└── README.md                # This file - quickstart guide
```

## For Claude Code Users

**Starting a new session?**

1. Read `.claude/README.md` - understand the .claude directory
2. Copy a template from `.claude/SESSION_STARTERS.md`
3. Load only what you need - see `.claude/features/` for detailed specs

**Minimal context approach:**
- `/DOCS_CONTEXT.md` = Project overview (always start here)
- `.claude/features/{name}.md` = Feature details (load on-demand)
- `.claude/features/feature-order.md` = Implementation sequence

## Architecture

This project follows a **feature-centered architecture** consistently implemented across all services:

### External Services (Remote)
- **Auth & User Management API** - Authentication, user profiles, subscriptions
- **SeaweedFS** - Distributed file storage (separate deployment)
- **LLM Service** - Name parsing and text analysis

### Local Services (This Build)
- **front-cards** - Next.js 16 web application (public-facing)
- **api-server** - Internal backend API (NOT the external auth)
- **render-worker** - Background card rendering with BullMQ
- **PostgreSQL** - Normalized application data
- **Cassandra** - Event logs and canonical data
- **Redis** - Job queue and caching

## Core Features

### 1. Template Designer
Visual editor for creating card layouts with:
- Text fields with auto-fit and multi-color styling
- Dynamic image elements (icons, logos)
- QR code generation
- Background image uploads

### 2. Batch Import
Import staff data from Excel or text with:
- Intelligent field mapping
- LLM-assisted name parsing (with credit management)
- Fallback to "as-is" when credits unavailable
- Phone vs extension detection

### 3. Background Rendering
Scalable card generation preserving InDesign layout logic:
- Canvas-based rendering (node-canvas or Puppeteer)
- Auto-fit text algorithm
- Dynamic icon positioning
- High-quality PNG/JPG export

## Feature-Based Development

Every feature is self-contained with:

```
{feature-name}/
├── components/      # UI components (frontend)
├── hooks/           # React hooks (frontend)
├── services/        # API clients or business logic
├── types/           # Feature-specific types
├── index.ts         # Public API exports
└── README.md        # Feature documentation
```

**Benefits:**
- Clear boundaries and ownership
- Easy context management for AI assistants
- Isolated testing
- Scalable codebase

## Documentation

- **[DOCS_CONTEXT.md](./DOCS_CONTEXT.md)** - Comprehensive project documentation
  - System overview and business context
  - Complete architecture diagrams
  - Domain models and data flows
  - External integrations
  - Implementation roadmap
  - .claude folder structure guide

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Feature-centered architecture
  - Wireframe descriptions for all views
  - Folder structure templates
  - Feature module standards
  - Mock data conventions
  - Configuration templates

- **[.claude/SESSION_STARTERS.md](./.claude/SESSION_STARTERS.md)** - Quick session templates
  - General project sessions
  - Feature-specific sessions
  - Bug fix and testing sessions

## Development Workflow

### 1. Start a New Session

Copy the relevant template from `.claude/SESSION_STARTERS.md` to load context quickly.

### 2. Create a New Feature

```bash
# TODO: Create /new slash command
# For now, manually create following the template in ARCHITECTURE.md
```

### 3. Run Tests

```bash
# Frontend
cd front-cards
npm test

# API Server
cd api-server
npm test

# Render Worker
cd render-worker
npm test
```

### 4. Database Migrations

```bash
# TODO: Create /migrate slash command
# For now:
cd api-server
npx prisma migrate dev
```

## Environment Configuration

All services now pull from the root-level `.env.dev.example` (and `.env.prod.example` for production defaults). Copy `.env.dev.example` to `.env` before running Docker or local scripts and adjust the values as needed. The compose file maps every variable directly, so you only need to maintain a single source of truth. Key entries include:

```bash
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ecards_db
POSTGRES_USER=ecards_user
POSTGRES_PASSWORD=ecards_dev_password

# Service ports / URLs
API_PORT=7400
API_INTERNAL_PORT=4000
API_URL=http://localhost:7400
NEXT_PUBLIC_API_URL=http://localhost:7400
NEXT_PUBLIC_WS_URL=ws://localhost:7400

# LLM Configuration (Name Parsing)
LLM_ENABLED=true
LLM_PRIMARY_PROVIDER=openai
LLM_FALLBACK_PROVIDER=deepseek
OPENAI_API_KEY=sk-proj-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
DEEPSEEK_API_KEY=sk-your-key

# External Services
SEAWEEDFS_ENDPOINT=http://remote-seaweedfs-host:8888
EXTERNAL_AUTH_URL=http://remote-auth-server:5000
EXTERNAL_SUBSCRIPTION_WS=ws://remote-auth-server:5000/ws
EXTERNAL_USER_API=http://remote-auth-server:5000/api/users

# JWT (internal session management)
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRY=7d
```

> See `.env.dev.example` for the complete list (Cassandra, Redis, worker settings, feature flags, etc.).

### LLM Provider Setup (Optional)

For intelligent name parsing, configure at least one LLM provider:

1. **Get API Key:**
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/settings/keys
   - DeepSeek: https://platform.deepseek.com/api_keys

2. **Set Environment Variables:**
   ```bash
   # Choose primary provider
   LLM_PRIMARY_PROVIDER=openai
   OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE

   # Optional fallback
   LLM_FALLBACK_PROVIDER=deepseek
   DEEPSEEK_API_KEY=sk-YOUR-KEY-HERE
   ```

3. **Restart Services:**
   ```bash
   docker-compose -f docker-compose.dev.yml restart api-server
   ```

See [DOCKER.md](./DOCKER.md#llm-configuration-name-parsing) for detailed LLM configuration guide.
```

## Tech Stack

### Frontend
- **Next.js 16** - App Router, React Server Components
- **React 19** - UI library
- **Tailwind CSS** - Styling
- **Fabric.js / Konva.js** - Canvas editor
- **Zod** - Validation

### Backend
- **Node.js 20+** - Runtime
- **TypeScript 5+** - Language
- **Fastify** - HTTP framework
- **Prisma** - PostgreSQL ORM
- **BullMQ** - Job queue
- **Zod** - Validation

### Worker
- **Node.js 20+** - Runtime
- **node-canvas / Puppeteer** - Rendering engine
- **sharp** - Image processing
- **qrcode** - QR generation

### Databases
- **PostgreSQL 16** - Application data (ACID)
- **Cassandra 5** - Event logs (high throughput)
- **Redis 7** - Queue and cache

## Key Architectural Decisions

### 1. Feature-Based Organization
All services use consistent feature modules for easier navigation and context management.

### 2. Shared Types Package
Single source of truth for domain models and API contracts prevents type drift.

### 3. Remote External Services
- SeaweedFS accessed as client (separate deployment)
- Auth/User API is external (this project's api-server is internal)
- Clear separation of concerns

### 4. Mock-First Development
All services include mock implementations demonstrating contracts before real logic.

### 5. Type Safety
Strict TypeScript, Zod validation, shared types across boundaries.

## Contributing

### Adding a New Feature

1. **Plan the feature** - Define purpose, components, API contracts
2. **Create feature structure** - Follow template in ARCHITECTURE.md
3. **Implement with mocks** - Start with mock data and services
4. **Write tests** - Cover happy path and error cases
5. **Connect real services** - Replace mocks with actual implementations
6. **Document** - Update feature README

### Code Standards

- **TypeScript strict mode** - No `any` types
- **Feature isolation** - No cross-feature imports
- **Explicit TODOs** - `// TODO [OWNER]: [ACTION]`
- **Mock markers** - `// MOCK: Description`
- **Tests required** - Every feature module

## License

MIT - See LICENSE file for details

## Support

- **Issues**: Report bugs and request features via GitHub issues
- **Documentation**: See DOCS_CONTEXT.md and ARCHITECTURE.md
- **Session Starters**: Use .claude/SESSION_STARTERS.md for quick context

---

**Version:** 1.0.0
**Last Updated:** 2025-01-14
