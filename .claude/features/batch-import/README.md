# Batch Import Feature

Field mapping and data import workflow for batch files.

## Overview

Handles the data import step after file parsing, including field mapping suggestions, data validation, and record import into the system.

## Status

PLACEHOLDER — service layer returns mock/structured placeholder responses; **Fastify routes for batch-import are not registered in `api-server/src/app.ts`**, so these endpoints are not exposed on the running API until wired (implementation exists under `api-server/src/features/batch-import/`, including `routes.fastify.ts`).

## User Stories

- As a user, I want to map file columns to card fields
- As a user, I want smart field mapping suggestions
- As a user, I want to preview imported data before finalizing
- As a user, I want to validate data before import

## Key Workflows

### 1. Field Mapping
1. User uploads file (via batch-upload)
2. File parsed to extract columns
3. System suggests field mappings
4. User reviews and adjusts mappings
5. User confirms and imports

## Dependencies

- **Depends on:** batch-upload, batch-parsing
- **Used by:** batch-records

## Configuration

See api-server/src/features/batch-import/README.md for full specification.
