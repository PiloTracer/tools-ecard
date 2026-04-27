# Tech Stack Reference

Quick reference guide for the E-Cards application stack, organized by service.

---

## Frontend Service (`front-cards`)

**Environment variables:** Only the **monorepo root** files — **`.env`** (local dev, final), **`.env.prd`** (production), templates **`.env.dev.example`** / **`.env.prd.example`**. There is no `front-cards/.env.local`. **Stack identity:** `TD_APP_CODE`, `TD_STACK_SUFFIX`, `COMPOSE_PROJECT_NAME` = `tools_dashboard` + suffix (e.g. `tools_dashboard_dev_tcrd` — see examples). Docker injects root `.env` via `env_file` on the `front-cards` service; host `npm run dev` / `npm run build` in `front-cards/` uses `scripts/preload-root-env.cjs` to load the same root `.env` before Next (without overwriting variables already set).

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

**Typical dev wiring:** Tools / identity often run on the **host** behind **`https://dev.aiepic.app`** while your OS maps that name to loopback (`/etc/hosts`). E-Cards in Docker must still reach that same host listener for server-side token exchange — see **`dev.aiepic.app` in Docker** below.

**Endpoints (environment-specific):** authorization, token, and userinfo URLs come from `OAUTH_*` and `NEXT_PUBLIC_OAUTH_*` variables — do not hardcode in code without checking config.

### Tools Dashboard (identity server — companion repo)

The authorization server, consent, and internal OAuth APIs live in the **Tools Dashboard** codebase (not this repo). Typical sibling checkout: **`../tools-dashboard`** next to **`tools-ecards`**.

| Artifact | Role |
|----------|------|
| `../tools-dashboard/docker-compose.dev.yml` | **`nginx-proxy`**: host **8082→80**, **8443→443**; **`back-auth`**, **`back-api`**, **`front-public`** (Remix) behind nginx |
| `../tools-dashboard/infra/nginx/default.conf` | **`/oauth/`** → `front-public:3000`; **`/api/`** → `back-api`; host TLS often fronts this (see comments in that file) |
| `../tools-dashboard/.env.dev.example` | **`TD_PUBLIC_BASE_URL`**, **`PUBLIC_APP_BASE_URL`**, **`OAUTH_CONSENT_SERVICE_SECRET`**; notes on HTTPS / mkcert for `dev.aiepic.app` |

When **`/etc/hosts`** maps **`dev.aiepic.app`** to loopback, E-Cards containers still need **`dev.aiepic.app:host-gateway`** (see below) so server-side token exchange reaches the same host edge (host nginx → **8082**/ **8443** or whatever your host TLS terminates to).

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

### `dev.aiepic.app` in Docker (hosts file + OAuth)

**Common setup:** `/etc/hosts` has **`127.0.0.1 dev.aiepic.app`** so the browser hits nginx / Tools on your **host** (same flow your `back-auth` / `nginx-proxy` logs show). That is correct for the browser.

**The pitfall:** Many Linux setups also make **Docker containers** resolve `dev.aiepic.app` to **`127.0.0.1` inside the container network** — not your host. Then server-side `fetch('https://dev.aiepic.app/oauth/token')` in `front-cards` talks to **port 443 on the container itself** → `ECONNREFUSED`, or unrelated TLS errors. The authorize step still “works” in the browser because the browser uses your real hosts file entry.

**What we do:** `docker-compose.dev.yml` sets **`extra_hosts: dev.aiepic.app:host-gateway`** on **`front-cards`** and **`api-server`** so those containers resolve `dev.aiepic.app` to the **host** (same machine nginx listens on), matching the browser.

Also:

- **`host.docker.internal:host-gateway`** — SeaweedFS and other host URLs on Linux.
- **TLS (mkcert):** Node often cannot verify the host’s `https://dev.aiepic.app` certificate. In **non-`production`**, OAuth server calls and the **Tools Dashboard app-library** startup GET (`api-server/src/core/integrations/appLibraryStorageIntegration.ts` via `oauthServerFetch`) use the same relaxed HTTPS client by default (`shared/server/oauth-fetch.ts` / `api-server/src/core/oauthFetch.ts`). Set **`OAUTH_DEV_INSECURE_TLS=0`** (or `false` / `off`) to force strict verification, then use **`NODE_EXTRA_CA_CERTS`** with a mounted CA bundle if needed. In **`production`**, those calls use strict TLS; use a publicly trusted cert on the dashboard or **`NODE_EXTRA_CA_CERTS`** on **`api-server`** if you must trust a private CA.

**Public-only dev (no hosts override):** If you do **not** map `dev.aiepic.app` to loopback, you can remove the `dev.aiepic.app:host-gateway` lines via a small **compose override** so containers use public DNS only.

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
- HTTPS (`https://dev.aiepic.app/oauth/token`, etc.) — from Docker, same host target as the browser when `extra_hosts` maps `dev.aiepic.app` to `host-gateway` (see above).

**Frontend → OAuth Server:**
- Browser: `https://dev.aiepic.app/oauth/authorize`, … — usually via OS **hosts** → loopback → nginx on the host.
- Server-side token exchange (`/oauth/complete`, `/api/auth/*`): same hostname; **`dev.aiepic.app:host-gateway`** avoids loopback-inside-container mistakes.

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
