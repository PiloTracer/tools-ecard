# Feature Plan: Batch Browsing (batch-view)

## Overview
**Feature Name:** `batch-view`
**Purpose:** Display and browse uploaded contact batches with detailed information and navigation to records
**Status:** Planning
**Priority:** High
**Complexity:** Medium

---

## User Story

**As a** user who has uploaded contact batches,
**I want to** view all my batches with their status and details,
**So that I can** monitor processing progress and access the records within each batch.

---

## Feature Requirements

### Functional Requirements

1. **Batch List Display**
   - Display all batches for the authenticated user
   - Order by upload date (descending - newest first)
   - Show key information for each batch:
     - File name
     - Upload date
     - Status (UPLOADED, PARSING, PARSED, LOADED, ERROR)
     - Record counts (total / processed)
     - File size
     - Processing timestamps

2. **Status Visualization**
   - Color-coded status badges matching existing UI:
     - UPLOADED: Blue
     - PARSING: Yellow (with spinner)
     - PARSED: Purple
     - LOADED: Green
     - ERROR: Red
   - Progress indicator when applicable

3. **Batch Actions**
   - **View Records**: Navigate to batch-records view for selected batch
   - **Download Original**: Download the original uploaded file (future enhancement)
   - **Delete Batch**: Remove batch and all associated records (with confirmation)

4. **Filtering & Search** (Phase 1 - Basic)
   - Filter by status
   - Search by file name
   - Date range filter

5. **Pagination**
   - Load batches in pages (20 per page)
   - Infinite scroll or traditional pagination controls

### Non-Functional Requirements

1. **Performance**
   - Initial load < 500ms for 100 batches
   - Query only PostgreSQL (normalized data)
   - Efficient indexing on userId, status, createdAt

2. **UX/UI**
   - Responsive design (desktop & tablet)
   - Loading states during fetch
   - Empty state when no batches exist
   - Error handling with user-friendly messages

3. **Security**
   - User can only view their own batches
   - Row-level filtering by userId
   - Validate batch ownership before navigation

---

## Technical Design

### Database Schema (Already Exists)

**PostgreSQL - batches table:**
```sql
id              UUID PRIMARY KEY
userId          UUID (foreign key to users)
userEmail       VARCHAR
projectId       UUID
projectName     VARCHAR
fileName        VARCHAR
fileSize        INTEGER
filePath        VARCHAR
status          ENUM (UPLOADED, PARSING, PARSED, LOADED, ERROR)
errorMessage    TEXT (nullable)
recordsCount    INTEGER (nullable)
recordsProcessed INTEGER (nullable)
parsingStartedAt TIMESTAMP (nullable)
parsingCompletedAt TIMESTAMP (nullable)
processedAt     TIMESTAMP (nullable)
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

**Indexes:**
- `userId` (already indexed)
- `status` (already indexed)
- `createdAt` (already indexed)
- `userEmail` (already indexed)

---

### API Endpoints

#### 1. GET `/api/batches` - List Batches
**Description:** Retrieve paginated list of batches for authenticated user

**Query Parameters:**
```typescript
{
  page?: number;          // Page number (default: 1)
  pageSize?: number;      // Items per page (default: 20, max: 100)
  status?: BatchStatus;   // Filter by status
  search?: string;        // Search in file name
  sortBy?: 'createdAt' | 'updatedAt';  // Sort field (default: createdAt)
  sortOrder?: 'asc' | 'desc';          // Sort direction (default: desc)
}
```

**Response:**
```typescript
{
  batches: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    status: BatchStatus;
    recordsCount: number | null;
    recordsProcessed: number | null;
    errorMessage: string | null;
    createdAt: string;  // ISO timestamp
    updatedAt: string;
    parsingStartedAt: string | null;
    parsingCompletedAt: string | null;
  }>;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
```

**Authentication:** Required (JWT from cookie)

#### 2. GET `/api/batches/:batchId` - Get Single Batch
**Description:** Retrieve detailed information for a specific batch

**Response:**
```typescript
{
  id: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  status: BatchStatus;
  recordsCount: number | null;
  recordsProcessed: number | null;
  errorMessage: string | null;
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  parsingStartedAt: string | null;
  parsingCompletedAt: string | null;
}
```

**Authentication:** Required (verify userId matches batch.userId)

#### 3. DELETE `/api/batches/:batchId` - Delete Batch
**Description:** Delete batch and all associated records

**Response:**
```typescript
{
  success: boolean;
  message: string;
  deletedRecordsCount: number;
}
```

**Side Effects:**
- Deletes batch from PostgreSQL
- Cascades to batch_records (PostgreSQL)
- Deletes contact_records from Cassandra (by batch_id)

**Authentication:** Required (verify userId matches batch.userId)

---

### Frontend Structure

```
front-cards/features/batch-view/
├── components/
│   ├── BatchList.tsx               # Main list component
│   ├── BatchCard.tsx                # Individual batch card
│   ├── BatchStatusBadge.tsx         # Status badge component (reuse from batch-upload)
│   ├── BatchFilters.tsx             # Filter controls
│   ├── BatchEmptyState.tsx          # Empty state UI
│   └── BatchDeleteDialog.tsx        # Confirmation dialog
├── hooks/
│   ├── useBatches.ts                # Fetch batches hook
│   ├── useBatchDelete.ts            # Delete batch hook
│   └── useBatchFilters.ts           # Filter state management
├── services/
│   └── batchViewService.ts          # API service layer
├── types/
│   └── index.ts                     # TypeScript interfaces
└── README.md                        # Feature documentation
```

---

### Backend Structure

```
api-server/src/features/batch-view/
├── controllers/
│   └── batchViewController.ts       # Route handlers
├── services/
│   └── batchViewService.ts          # Business logic
├── repositories/
│   └── batchViewRepository.ts       # Database operations
├── types.ts                         # TypeScript interfaces
├── routes.ts                        # API routes
└── README.md                        # Feature documentation
```

---

## Implementation Plan

### Phase 1: Backend Foundation (Day 1)

**Tasks:**
1. Create feature structure (`api-server/src/features/batch-view/`)
2. Implement `batchViewRepository.ts`
   - `findBatchesByUser(userId, filters, pagination)`
   - `findBatchById(batchId, userId)`
   - `deleteBatch(batchId, userId)` (with Cassandra cleanup)
3. Implement `batchViewService.ts`
   - Business logic layer
   - Input validation
   - Permission checks
4. Implement `batchViewController.ts`
   - GET `/api/batches`
   - GET `/api/batches/:batchId`
   - DELETE `/api/batches/:batchId`
5. Register routes in main app

**Testing:**
- Unit tests for repository methods
- Integration tests for API endpoints
- Test with mock data

### Phase 2: Frontend Components (Day 2)

**Tasks:**
1. Create feature structure (`front-cards/features/batch-view/`)
2. Implement `batchViewService.ts` (API client)
3. Implement hooks:
   - `useBatches` (fetch with pagination)
   - `useBatchDelete` (delete with optimistic updates)
   - `useBatchFilters` (filter state)
4. Implement components:
   - `BatchCard.tsx` (reuse status badge from batch-upload)
   - `BatchList.tsx` (main container)
   - `BatchFilters.tsx` (search & filter UI)
5. Create page: `app/batches/page.tsx`

**Testing:**
- Component tests with React Testing Library
- Test loading states
- Test empty states
- Test error handling

### Phase 3: Integration & Polish (Day 3)

**Tasks:**
1. Connect frontend to backend
2. Implement real-time status updates (poll for PARSING batches)
3. Add navigation to batch-records view
4. Polish UI/UX:
   - Loading skeletons
   - Error states
   - Empty states
   - Responsive design
5. Add confirmation dialogs for delete
6. Integrate with auth middleware

**Testing:**
- End-to-end testing
- Cross-browser testing
- Mobile responsiveness
- Performance testing

### Phase 4: Enhancement (Future)

**Tasks:**
1. Export to CSV functionality
2. Bulk operations (delete multiple batches)
3. Advanced filtering (date ranges, record count ranges)
4. Batch statistics dashboard
5. Search within batch records (quick preview)

---

## Data Flow

```
User → BatchList (Frontend)
  ↓
useBatches hook → batchViewService.getBatches()
  ↓
GET /api/batches?page=1&status=LOADED
  ↓
batchViewController.listBatches()
  ↓
batchViewService.listBatches(userId, filters)
  ↓
batchViewRepository.findBatchesByUser(userId, filters)
  ↓
PostgreSQL: SELECT * FROM batches WHERE user_id = ? ORDER BY created_at DESC
  ↓
Return: { batches: [...], pagination: {...} }
  ↓
Render: BatchCard components with status badges
```

---

## UI/UX Mockup

```
┌─────────────────────────────────────────────────────────┐
│  My Batches                                    [+ Upload]│
├─────────────────────────────────────────────────────────┤
│  [Search...] [Status: All ▼] [Date: All ▼]             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ batch-sample-01.txt                    [LOADED ✓]  │ │
│  │ 1.67 KB • 2 records                                │ │
│  │ Uploaded: 11/25/2025 9:28 PM                       │ │
│  │ Completed: 11/25/2025 9:28 PM                      │ │
│  │                                                     │ │
│  │ [View Records]  [Delete]                           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ contacts-export.csv            [PARSING ⟳]         │ │
│  │ 12.3 KB • Processing... 45/100 records             │ │
│  │ Uploaded: 11/25/2025 8:15 PM                       │ │
│  │ ████████████░░░░░░░░ 45%                           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ team-directory.xlsx                    [ERROR ✗]   │ │
│  │ 5.2 KB • Failed to parse                           │ │
│  │ Uploaded: 11/24/2025 3:42 PM                       │ │
│  │ Error: Invalid file format                         │ │
│  │                                                     │ │
│  │ [Retry]  [Delete]                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Showing 1-20 of 47 batches                             │
│  [← Previous]  Page 1 of 3  [Next →]                    │
└─────────────────────────────────────────────────────────┘
```

---

## Success Criteria

- [ ] User can view list of all uploaded batches
- [ ] Batches are sorted by upload date (newest first)
- [ ] Each batch shows status, record counts, and timestamps
- [ ] Status is color-coded and matches existing design
- [ ] User can filter batches by status
- [ ] User can search batches by file name
- [ ] User can navigate to batch-records view by clicking "View Records"
- [ ] User can delete a batch with confirmation
- [ ] List loads in < 500ms for 100 batches
- [ ] UI is responsive on desktop and tablet
- [ ] Empty state displays when user has no batches
- [ ] Error states are handled gracefully

---

## Dependencies

- ✅ Prisma schema with `batches` table (already exists)
- ✅ Auth middleware (already exists)
- ✅ Batch upload feature (already exists)
- ⏳ Batch records feature (to be implemented)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Large batch lists slow to load | Implement pagination, virtualization if needed |
| Deleting batch with many records is slow | Implement async deletion with status updates |
| Real-time status updates create load | Use efficient polling (5s intervals) only for active batches |
| User accidentally deletes batch | Require confirmation dialog, consider soft delete |

---

## Notes

- This feature only queries PostgreSQL for performance (no Cassandra reads)
- Reuse `BatchStatusBadge` component from `batch-upload` feature
- Integrate with existing auth and project selection
- Consider adding batch archiving in future iterations
- Ensure consistent styling with template browsing features

---

**Created:** 2025-11-26
**Last Updated:** 2025-11-26
**Author:** Feature-Worker Agent
