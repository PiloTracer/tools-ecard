# ADR 006 — S3-compatible storage via SeaweedFS

**Status:** Decided · 2026-04-27 (brownfield synthesis)
**Owner:** eng
**Supersedes:** -

## Context

The E-Cards application needs object storage for template assets (background images, uploaded fonts) and generated card outputs. Storage must support presigned URLs for secure browser-based access.

**Alternatives considered:**
- AWS S3 — managed but adds cloud dependency and cost
- MinIO — S3-compatible, self-hosted, widely adopted
- Local filesystem — simple but doesn't scale across services

## Decision

Use **SeaweedFS** as a self-hosted S3-compatible object store. Access via `@aws-sdk/client-s3` SDK for presigned URLs and file operations. A `localStorageService` fallback exists for development environments without SeaweedFS.

**Evidence:** `api-server/src/features/s3-bucket/` with `s3Service.ts` and `localStorageService.ts`, SeaweedFS configuration in `DOCS_TECH_STACK.md`.

## Consequences

- **Positive:** S3-compatible API allows future migration to AWS S3 without code changes
- **Positive:** Presigned URL pattern keeps credentials off the client
- **Positive:** Self-hosted, no external cloud costs
- **Negative:** Additional service to manage and monitor
- **Negative:** SeaweedFS has a smaller community than MinIO
