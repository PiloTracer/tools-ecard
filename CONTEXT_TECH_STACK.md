# Tech Stack Reference

Quick reference guide for the E-Cards application stack, organized by service.

---

## Frontend Service (`front-cards`)

**Framework:** Next.js 16 (App Router, React Server Components)
**Language:** TypeScript
**Runtime:** Node.js (in Docker container)
**Key Libraries:**
- React 19 (UI components)
- Tailwind CSS (styling)
- Next.js API Routes (backend-for-frontend pattern)

**Features:**
- OAuth 2.0 client (PKCE support)
- Server-side rendering (SSR)
- HTTP-only cookie authentication
- Server-side token exchange

**Port:** 7300 (host) → 3000 (container)

---

## API Server (`api-server`)

**Framework:** Express.js (Node.js)
**Language:** TypeScript
**Runtime:** Node.js
**Key Libraries:**
- Express (HTTP server)
- Socket.IO (WebSocket communication)
- Cassandra driver (event store)
- PostgreSQL driver (relational data)
- Redis client (caching, job queue)

**Features:**
- RESTful API endpoints
- WebSocket support for real-time updates
- LLM integration (OpenAI, Anthropic, DeepSeek)
- Rate limiting
- JWT token generation (internal)

**Port:** 7400 (host) → 4000 (container)

---

## Render Worker (`render-worker`)

**Framework:** Node.js worker service
**Language:** TypeScript
**Runtime:** Node.js
**Key Libraries:**
- Bull/BullMQ (job queue processing)
- Canvas/Sharp (image rendering)
- Redis client (job queue)
- PostgreSQL driver (job metadata)

**Features:**
- Background job processing
- E-card rendering engine
- Image generation and manipulation
- Retry logic with exponential backoff

**Port:** Internal only (no external port)

---

## Database Layer

### PostgreSQL (`postgres`)

**Version:** 16 Alpine
**Purpose:** Normalized relational data
**Schema:**
- Users, subscriptions, templates
- Batches, cards metadata
- Financial/billing data

**Port:** 7432 (host) → 5432 (container)

### Cassandra (`cassandra`)

**Version:** 5.0
**Purpose:** Canonical event/log store
**Keyspace:** `ecards_canonical`
**Schema:**
- Event logs (card generation events)
- Audit trails
- High-write, time-series data

**Port:** 7042 (host) → 9042 (container)

### Redis (`redis`)

**Version:** 7 Alpine
**Purpose:** Cache and job queue
**Features:**
- Session caching
- Job queue (Bull/BullMQ)
- Rate limiting storage
- Pub/sub messaging

**Port:** 7379 (host) → 6379 (container)

---

## External Services

### OAuth Server (Tools Dashboard)

**Location:** `tools-dashboard` (separate project)
**Purpose:** OAuth 2.0 authorization server
**Stack:**
- FastAPI (Python backend)
- PostgreSQL (client registration)
- Cassandra (authorization codes, tokens)
- RSA key management (JWT signing)

**Endpoints:**
- `/oauth/authorize` - Authorization endpoint
- `/oauth/token` - Token exchange endpoint
- `/api/users/me` - User info endpoint

**Domain:** `epicdev.com` (mapped to localhost via hosts file)

### SeaweedFS (Remote)

**Purpose:** S3-compatible object storage
**Usage:** Rendered card image storage
**Access:** S3 API with access/secret keys

### LLM Providers

**OpenAI:** GPT-4o-mini (name parsing)
**Anthropic:** Claude 3.5 Sonnet (fallback)
**DeepSeek:** DeepSeek Chat (cost-effective fallback)

---

## Development Environment

### Containerization

**Tool:** Docker Compose
**Config:** `docker-compose.dev.yml`
**Network:** Bridge network (`ecards-network`)
**Volumes:** Persistent data for PostgreSQL, Cassandra, Redis

### Build Tools

**Frontend:**
- Next.js dev server (Turbopack)
- TypeScript compiler
- Tailwind CSS processor

**Backend:**
- TypeScript (ts-node for dev)
- Nodemon (hot reload)
- ESLint + Prettier

### DNS Resolution

**Special Configuration:**
- `extra_hosts: epicdev.com:host-gateway` in Docker Compose
- Allows containers to resolve `epicdev.com` to host machine
- Enables OAuth server communication from within containers

---

## Authentication & Security

### OAuth 2.0 Flow

**Standard:** OAuth 2.0 with PKCE (RFC 7636)
**Implementation:**
- Authorization Code Grant
- PKCE for manual login (S256 challenge method)
- Client credentials for pre-initiated flows
- State parameter (CSRF protection)

### Token Storage

**Access Tokens:** HTTP-only cookies (`ecards_auth`)
**Refresh Tokens:** HTTP-only cookies (`ecards_refresh`)
**PKCE Data:** HTTP-only cookies (10 min expiry)
**User ID:** Regular cookie (client-readable)

### Security Features

- HTTP-only cookies (XSS protection)
- SameSite: Lax (CSRF protection)
- bcrypt password hashing
- JWT token signing (RS256)
- Rate limiting on auth endpoints

---

## API Communication

### Internal APIs

**Frontend → API Server:**
- HTTP REST (port 7400)
- WebSocket (ws://localhost:7400)

**API Server → Databases:**
- PostgreSQL: Direct connection (port 5432 within network)
- Cassandra: Direct connection (port 9042 within network)
- Redis: Direct connection (port 6379 within network)

### External APIs

**API Server → OAuth Server:**
- HTTP (http://epicdev.com/oauth/token)
- Uses `extra_hosts` for DNS resolution

**Frontend → OAuth Server:**
- Browser redirects (http://epicdev.com/oauth/authorize)
- Server-side token exchange (http://epicdev.com/oauth/token)

---

## Key Design Patterns

### Backend-for-Frontend (BFF)

Frontend has API routes (`/api/*`) that act as a BFF layer:
- `/api/auth/login` - OAuth initiation
- `/api/auth/user` - User info proxy
- `/oauth/complete` - OAuth callback handler

### Event-Driven Architecture

- PostgreSQL: Source of truth for normalized data
- Cassandra: Event log for audit/analytics
- Redis Pub/Sub: Real-time updates

### Microservices Pattern

Each service has a single responsibility:
- `front-cards`: User interface + OAuth client
- `api-server`: Business logic + API
- `render-worker`: Background job processing

---

## Environment Variables

### Critical Configuration

**OAuth:**
- `OAUTH_CLIENT_ID` - Client identifier
- `OAUTH_CLIENT_SECRET` - Client secret (keep secure!)
- `OAUTH_REDIRECT_URI` - Callback URL

**Database:**
- `POSTGRES_*` - PostgreSQL connection
- `CASSANDRA_*` - Cassandra connection
- `REDIS_*` - Redis connection

**LLM:**
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `DEEPSEEK_API_KEY` - DeepSeek API key

---

## Port Reference

| Service | Host Port | Container Port | Protocol |
|---------|-----------|----------------|----------|
| Frontend | 7300 | 3000 | HTTP |
| API Server | 7400 | 4000 | HTTP/WS |
| PostgreSQL | 7432 | 5432 | TCP |
| Cassandra | 7042 | 9042 | TCP |
| Redis | 7379 | 6379 | TCP |

---

## Quick Start Commands

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f front-cards
docker-compose logs -f api-server

# Rebuild specific service
docker-compose up -d --build front-cards

# Stop all services
docker-compose down

# Reset databases (destructive!)
docker-compose down -v
```

---

## Related Projects

**Tools Dashboard:** OAuth 2.0 authorization server (FastAPI + Python)
**Project Location:** `D:\Projects\EPIC\tools-dashboard`

**E-Cards Application:** This project
**Project Location:** `D:\Projects\EPIC\tools-ecards`

---

## Notes for AI Agents

- **Next.js 16:** Uses App Router (not Pages Router), React Server Components
- **TypeScript:** All services use TypeScript with strict mode
- **Docker Networking:** Services communicate via service names (e.g., `postgres`, `cassandra`)
- **OAuth Flow:** Server-side callback route (not client-side) for AdGuard compatibility
- **Database Choice:** PostgreSQL for normalized data, Cassandra for events/logs
- **Authentication:** HTTP-only cookies, no localStorage/sessionStorage for tokens
