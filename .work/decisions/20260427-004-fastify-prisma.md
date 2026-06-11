# ADR 004 — Fastify + Prisma for API server

**Status:** Decided · 2026-04-27 (brownfield synthesis)
**Owner:** eng
**Supersedes:** -

## Context

The API server (`api-server/`) handles REST and WebSocket endpoints, database access, job queue management, and external service integration.

**Alternatives considered:**
- Express.js — mature but lacks built-in TypeScript support, slower
- NestJS — opinionated framework, heavier than needed for current scope
- Hono — newer, smaller ecosystem

## Decision

Use **Fastify** as the HTTP framework with **Prisma** as the PostgreSQL ORM. Fastify provides TypeScript-native plugin architecture, schema validation, and WebSocket support via `@fastify/websocket`. Prisma provides type-safe database access and migration management.

**Evidence:** `api-server/package.json` (Fastify + Prisma deps), `api-server/src/app.ts` (Fastify app setup), `api-server/prisma/` (schema).

## Consequences

- **Positive:** Fastify is one of the fastest Node.js HTTP frameworks
- **Positive:** Prisma provides generated TypeScript types from schema
- **Positive:** Plugin architecture (CORS, cookies, multipart, WebSocket) is modular
- **Negative:** Prisma migrations differ from the `@db-migration` skill's numbered-SQL convention — Prisma manages its own migration system
- **Negative:** Fastify's hook-based middleware model differs from Express — auth middleware pattern is non-standard
