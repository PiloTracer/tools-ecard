# Architectural Decision Records (ADRs)

Project-specific ADRs. Process: `.ai/skills/plan-foundation/skill.md` P2 · pointer: `.ai/decisions/README.md`.

## Conventions

- **Filename:** `YYYYMMDD-NNN-short-slug.md` (3-digit zero-padded NNN)
- **Status:** `Proposed | Decided | Deferred | Superseded by <ADR id>`
- **Sections:** Context · Decision · Consequences · Alternatives · References
- **Never edit** a `Decided` ADR - supersede with a new file
- Foundation register in `*-04-foundation-architecture.md` §13 must agree; **ADRs win** on conflict

## Index

| ADR | Topic | Status |
|-----|-------|--------|
| 001 | Monorepo architecture | Decided |
| 002 | Dual database Postgres + Cassandra | Decided |
| 003 | Next.js App Router | Decided |
| 004 | Fastify + Prisma | Decided |
| 005 | Docker Compose | Decided |
| 006 | SeaweedFS storage | Decided |
| 007 | Demo mode browser persistence | Decided |

**Template:** `.ai/templates/work/decisions/YYYYMMDD-NNN-slug.md.template`
