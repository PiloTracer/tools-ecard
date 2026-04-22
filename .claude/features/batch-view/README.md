# Batch View Feature

Batch listing and detail viewing with filtering and search.

## Overview

Provides UI and API for viewing batch lists, filtering by status, searching by name, and displaying batch details with record previews.

## User Stories

- As a user, I want to see all my uploaded batches
- As a user, I want to filter batches by status
- As a user, I want to search batches by filename
- As a user, I want to see batch details and record count

## Key Workflows

### 1. List Batches
1. User navigates to batches page
2. Batches fetched from PostgreSQL
3. Filtered by user and project
4. Sorted by date descending
5. Paginated results displayed

### 2. View Batch Details
1. User clicks on batch
2. Batch metadata loaded
3. Record count retrieved
4. Sample records displayed
5. Actions available (download, delete, regenerate)

## Dependencies

- **Depends on:** batch-upload
- **Used by:** batch-records
