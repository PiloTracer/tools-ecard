# Batch Parsing Feature

Background worker for parsing uploaded batch files into structured contact records.

## Overview

Processes uploaded files (`.csv`, `.txt`, `.vcf`, `.xls`, `.xlsx` per batch-upload allowlist) asynchronously via a **Python subprocess** from Node, with LLM-assisted name parsing when enabled, and stores records in Cassandra (with PostgreSQL batch status).

## User Stories

- As a system, I need to parse uploaded files in the background
- As a user, I want intelligent name parsing using AI
- As a user, I want to see parsing progress in real-time

## Key Workflows

### 1. Parse Batch File
1. Job picked from Redis queue
2. File fetched from storage
3. File format detected and parser selected
4. Rows extracted and validated
5. Names parsed using LLM (if enabled)
6. Records stored in Cassandra
7. Batch status updated to "parsed"

## Dependencies

- **Depends on:** batch-upload, s3-bucket
- **Used by:** batch-records

## Configuration

- LLM providers: OpenAI, Anthropic, DeepSeek
- Fallback: Parse as-is when LLM unavailable

## APIs (read/search vs edit)

- **Search and cross-batch reads:** HTTP routes under `/api/batch-records` (implemented in `batch-parsing/routes.fastify.ts`). See `feature.yaml`.
- **Per-batch record edits:** `/api/batches/:batchId/records` — documented under **batch-records**.

## Diagnostics

- `GET /api/diagnostics/queue-stats` — Redis queue + worker stats (see `batch-parsing/routes/diagnostics.fastify.ts`).
- `GET /api/diagnostics/redis-status` — Redis connectivity probe.

These diagnostic routes do not enforce auth in code; protect them in production (network policy or auth plugin).
