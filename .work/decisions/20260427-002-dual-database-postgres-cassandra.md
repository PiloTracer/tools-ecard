# ADR 002 — Dual database: PostgreSQL + Cassandra

**Status:** Decided · 2026-04-27 (brownfield synthesis)  
**Owner:** eng  
**Supersedes:** -

## Context

The E-Cards application handles two distinct data profiles: relational/transactional (users, templates, batches, cards) and high-volume event/time-series data (card generation events, audit trails).

**Alternatives considered:**
- Single PostgreSQL for all data — simpler but event tables grow rapidly
- Single Cassandra for all data — poor relational query support for templates/batches
- MongoDB — not aligned with existing schema design

## Decision

Use **PostgreSQL 16** for normalized relational data (via Prisma ORM) and **Cassandra 5** for event logs and audit trails (via `cassandra-driver` and init `.cql` scripts).

- PostgreSQL schema managed by Prisma (`api-server/prisma/`)
- Cassandra schema managed by idempotent CQL scripts (`db/init-cassandra/`)

**Evidence:** `docker-compose.dev.yml` includes both databases; Prisma schema and Cassandra CQL scripts exist.

## Consequences

- **Positive:** Each database optimized for its workload (relational ACID vs high-write event log)
- **Negative:** Two migration systems to maintain (Prisma + CQL scripts)
- **Negative:** Cassandra 5 has materialized view constraints that have caused issues in the past (see `.work/operations/fixes/from-claude/`)
- **Negative:** Application code must manage two database connections
