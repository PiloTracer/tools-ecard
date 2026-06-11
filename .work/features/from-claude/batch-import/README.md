# Batch Import Feature

Field mapping and data import workflow for batch files.

## Overview

Handles the data import step after file parsing, including field mapping suggestions, data validation, and record import into the system.

## Status

PLACEHOLDER — service layer still returns mock/structured placeholder responses for most operations. **Fastify routes are registered** in `api-server/src/app.ts` under prefix **`/api/batch-import`** (see `feature.yaml` for example paths). Behavior remains placeholder until business logic is implemented.

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
