# Database Setup Feature

**Priority:** CRITICAL
**Status:** Planned
**Dependencies:** None

## Purpose

Establish database schemas for PostgreSQL (normalized) and Cassandra (canonical events).

## Deliverables

- Prisma schema with all models
- Database migrations
- TypeScript types
- Seed data for development

## Key Models

**PostgreSQL:**
- User, UserSession, Template, Batch, CanonicalStaff, RenderJob

**Cassandra:**
- AuthAuditLog, BatchEventLog

**See `/CONTEXT.md` for detailed schema definitions**

