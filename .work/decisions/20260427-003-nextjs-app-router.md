# ADR 003 — Next.js 16 App Router + React Server Components for frontend

**Status:** Decided · 2026-04-27 (brownfield synthesis)
**Owner:** eng
**Supersedes:** -

## Context

The frontend UI (`front-cards/`) needs a framework for server-rendered pages with modern React patterns, BFF API routes, and OAuth integration.

**Alternatives considered:**
- Pages Router (Next.js older convention) — deprecated pattern
- Pure SPA (React + Vite) — loses SSR benefits for auth and performance
- Remix — different routing model, less ecosystem familiarity

## Decision

Use **Next.js 16 with App Router and React Server Components**. BFF API routes use Next.js API Routes (`app/api/`). Authentication flows (OAuth PKCE, cookie management, token exchange) live in the Next.js BFF layer, not in the browser.

**Evidence:** `front-cards/package.json`, `front-cards/app/` structure with App Router.

## Consequences

- **Positive:** Server-side rendering for initial page load; BFF pattern keeps tokens out of browser
- **Positive:** App Router provides nested layouts, streaming, and React 19 support
- **Negative:** Build tooling complexity (Next.js config, path aliases, Docker build stages)
- **Negative:** Server Components can't use browser APIs directly — need 'use client' boundaries
