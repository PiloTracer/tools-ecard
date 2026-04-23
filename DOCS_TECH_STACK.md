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

**Framework:** Fastify (Node.js)
**Language:** TypeScript
**Runtime:** Node.js
**Key Libraries:**
- Prisma (PostgreSQL ORM)
- Fastify + `@fastify/websocket` (WebSocket)
- `cassandra-driver` (event log / audit patterns)
- Redis + Bull/BullMQ (queues)
- S3 / storage clients for remote object storage

**Features:**
- RESTful API and WebSocket routes
- LLM integration (OpenAI, Anthropic, DeepSeek) where configured
- Rate limiting, JWT and cookie-based session patterns

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

### OAuth / user management (remote)

**Purpose:** OAuth 2.0 and user APIs used **as a client** by this app (this repo is not the auth server).

**Typical dev wiring:** use the hosted **`https://dev.aiepic.app`** endpoints (public DNS and TLS). Optional: run OAuth on loopback with hosts + compose override — see **`dev.aiepic.app` (default: public HTTPS)** below.

**Endpoints (environment-specific):** authorization, token, and userinfo URLs come from `OAUTH_*` and `NEXT_PUBLIC_OAUTH_*` variables — do not hardcode in code without checking config.

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

### `dev.aiepic.app` (default: public HTTPS)

**Default (recommended):** Do **not** map `dev.aiepic.app` in `/etc/hosts`. The browser and Docker containers resolve **`https://dev.aiepic.app`** with normal DNS and a public certificate chain. Server-side OAuth in `front-cards` (for example `app/oauth/complete/route.ts`) and the API use the same hostnames and hit the **same** endpoints as your browser.

If you still have **`127.0.0.1 dev.aiepic.app`** from an old setup, remove it unless you are doing **advanced — OAuth only on your machine** below; otherwise the browser can get an authorization code from a **local** server while the container exchanges it with the **public** server, which fails in confusing ways.

**Inside Docker** (`front-cards`, `api-server`), `docker-compose.dev.yml` sets:

- `extra_hosts: host.docker.internal:host-gateway` — so URLs like `http://host.docker.internal:8333` (SeaweedFS, etc.) work on **Linux** where that name is not built in.

`dev.aiepic.app` is **not** mapped to `host-gateway` by default. Mapping it forced containers to talk to whatever TLS was listening on your **host** for that name, which often did **not** match the public `dev.aiepic.app` certificate and caused `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in Node even when the real site was fine in the browser.

**Advanced — OAuth only on your machine:** If you intentionally run the auth stack on loopback, add `127.0.0.1 dev.aiepic.app` to the OS hosts file for the **browser**, and use a **compose override** that adds `extra_hosts: dev.aiepic.app:host-gateway` for `front-cards` and `api-server` so containers reach that host listener. If that listener uses a private CA (mkcert, corporate TLS), set `NODE_EXTRA_CA_CERTS` in `.env` to a PEM path readable inside the container (mount the file in the override). See `.env.dev.example` for an optional placeholder.

After changing hosts or compose, restart containers: `docker compose -f docker-compose.dev.yml up -d`.

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
- HTTPS (`https://dev.aiepic.app/oauth/token`, etc.) — public DNS from the container unless you add a compose override for host-local OAuth.

**Frontend → OAuth Server:**
- Browser redirects (`https://dev.aiepic.app/oauth/authorize`, …) — normal DNS by default; optional OS **hosts** file only for advanced local-OAuth setups.
- Server-side token exchange from Next routes uses the same configured URLs and **public** `dev.aiepic.app` TLS by default.

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

## Related projects

- **This repo:** E-Cards monorepo (`tools-ecards`).
- **Other EPIC services** (OAuth, admin, etc.): live in their own repositories; this app **calls** them — see `DOCS_CONTEXT.md` and **`.claude/features/`** (e.g. auto-auth).

---

## Notes for AI agents

- **Next.js 16:** App Router, RSC where applicable — confirm per route under `front-cards/app/`.
- **TypeScript:** Services aim for strict typing; use existing patterns in each package.
- **Docker networking:** Services reach each other by compose service name (`postgres`, `redis`, `cassandra`, `api-server`, etc.).
- **Databases:** PostgreSQL for relational data; Cassandra for high-write / event-style tables per `db/init-cassandra/`.
- **Auth:** HTTP-only cookies and OAuth flows as implemented — read env + feature docs before changing.
- **Editor MCP (`.cursor/mcp.json`):** Cursor loads [project MCP](https://cursor.com/docs/mcp) from **`.cursor/mcp.json`** (same folder as this file’s parent is the workspace root). The `filesystem` server uses **`${workspaceFolder}`** so it works on any machine. The **Postgres** URL matches default **dev** compose (`ecards_user` / `ecards_dev_password` on host port **7432**); override locally via your user **`~/.cursor/mcp.json`** or by changing the project entry if your DB differs. Prefer **`${env:VAR}`** for secrets (see Cursor MCP docs — never commit production credentials).
