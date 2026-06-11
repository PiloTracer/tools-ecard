# Threat Model — tools-ecards

**Status:** Draft (brownfield synthesis)
**Pairs with:** `.work/docs/standards/CONVENTIONS.md`, ADRs, FEATURE_STANDARD

---

## 1. Assets

| Id | Asset | Impact if lost or tampered |
|----|-------|----------------------------|
| A1 | User PII (names, emails, phones imported in batch records) | Regulatory (GDPR), reputational harm |
| A2 | OAuth tokens and session cookies | Account takeover |
| A3 | Batch import data (spreadsheet contents) | Business data leak, competitive harm |
| A4 | Template designs and assets | IP loss |
| A5 | Rendered card images (customer-facing output) | Brand integrity if tampered |
| A6 | SeaweedFS / S3 access credentials | Unauthorized access to all stored assets |

## 2. Trust boundaries

```text
[Browser] ──TLS──▶ [Next.js BFF (front-cards)] ──cookie──▶ [Fastify API (api-server)]
                      │                                          │
                      │                                    ┌─────┴──────┐
                      │                              [PostgreSQL]  [Cassandra]
                      │                                    │
                      ├──▶ [BullMQ Queue (Redis)] ──▶ [render-worker]
                      │                                          │
                      │                                    [SeaweedFS (S3)]
                      │
                      └──▶ [External OAuth Provider]
```

**Auth mechanisms per arrow:**
- Browser → Next.js: HTTPS + HTTP-only cookies (OAuth PKCE flow)
- Next.js → Fastify: Cookie-based session token, validated by `authMiddleware`
- Fastify → PostgreSQL: Prisma ORM (connection via `DATABASE_URL`)
- Fastify → Cassandra: `cassandra-driver` with credentials
- Fastify → Redis: BullMQ with optional password
- Fastify → SeaweedFS: S3 credentials via `@aws-sdk/client-s3`
- Render-worker → Redis: BullMQ connection (same Redis)
- Render-worker → SeaweedFS: S3 credentials via `@aws-sdk/client-s3`
- Render-worker → PostgreSQL: Prisma client (same schema as api-server)

## 3. STRIDE (per boundary)

| Threat | Boundary | Mitigation |
|--------|----------|------------|
| **Spoofing** | Browser → API | OAuth 2.0 PKCE + JWT validation in authMiddleware |
| **Tampering** | API → Databases | Prisma parameterized queries; Cassandra prepared statements |
| **Repudiation** | Batch operations | Cassandra audit log; batch status tracking |
| **Information disclosure** | S3 storage | Presigned URLs for access; no public buckets |
| **Denial of service** | API → Queue | Rate limiting in Fastify; BullMQ backpressure |
| **Elevation of privilege** | API endpoints | authMiddleware on every route; user ID scoping in queries |

## 4. High-risk areas

| Module | Risk | Requires |
|--------|------|----------|
| Auth (OAuth PKCE flow, token handling) | Token leakage, CSRF | ≥2 reviewers for auth changes |
| Batch import (user data parsing) | PII mishandling | Guard against logging raw record data |
| Render worker (card generation) | S3 credential exposure | No credential logging in worker |
| S3 storage (SeaweedFS) | Bucket misconfiguration | Presigned URLs only; no public listing |

## 5. Supply chain

- Dependencies pinned in `DOCS_TECH_STACK.md` and `package.json` lockfiles
- No secrets committed to repo (`.env*` in `.gitignore`)
- CI runs `npm ci` from lockfiles for reproducible builds
- Canvas and Sharp native deps installed via system packages in CI

## 6. Incident response

- **Service down:** `docker compose logs -f <service>` to diagnose
- **Data breach:** Identify affected records via batch IDs in PostgreSQL
- **S3 credential leak:** Rotate SeaweedFS access keys, update `.env`
- **Runbook:** `.work/docs/runbooks/operations-runbook.md`

## 7. Review cadence

- Revisit on any ADR that adds a new external integration or changes auth boundaries
- Before first production deployment
- After any security-related code change
