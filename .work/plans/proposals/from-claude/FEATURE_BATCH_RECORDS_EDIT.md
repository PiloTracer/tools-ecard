# Feature Plan: Batch Records View & Edit (batch-records)

## Overview
**Feature Name:** `batch-records`
**Purpose:** Display and edit contact records from a specific batch with full vCard details
**Status:** Planning
**Priority:** High
**Complexity:** High

---

## User Story

**As a** user viewing a batch,
**I want to** see all contact records in the batch and edit their details,
**So that I can** review, correct, and maintain accurate contact information.

---

## Feature Requirements

### Functional Requirements

1. **Record List Display**
   - Display all records from a specific batch
   - Pull complete vCard data from Cassandra
   - Show key fields in table/card view:
     - Full name (first + last)
     - Email
     - Work phone & mobile phone
     - Business title & company
   - Expandable rows to show all 30+ fields

2. **Search & Filter**
   - Full-text search across ALL fields (search in complete canonical record)
   - Filter by:
     - Has email
     - Has phone
     - Has business info
     - Missing required fields
   - Real-time filtering as user types

3. **Record Editing**
   - Click to edit any record
   - Edit modal/drawer with form fields
   - Support for all vCard fields:
     - Personal: Name, contact methods, address
     - Business: Company, title, department, address
     - Social: LinkedIn, Twitter, Facebook, Instagram
     - Additional: Bio, birthday, URL
   - Input validation (email format, phone format, etc.)
   - Save changes to both PostgreSQL and Cassandra

4. **Bulk Operations** (Phase 2)
   - Select multiple records
   - Bulk delete
   - Bulk export (CSV, vCard)
   - Bulk edit (update common fields)

5. **Record Actions**
   - **Edit**: Modify record details
   - **Delete**: Remove record (with confirmation)
   - **Export**: Download as vCard (.vcf)
   - **Preview**: View formatted vCard preview
   - **Duplicate**: Create copy of record (future)

### Non-Functional Requirements

1. **Performance**
   - Load 1000 records in < 2 seconds
   - Search/filter response < 200ms
   - Virtual scrolling for large record sets
   - Lazy load full details on expand/edit

2. **UX/UI**
   - Responsive design (desktop, tablet, mobile)
   - Loading states during operations
   - Optimistic updates for better UX
   - Keyboard shortcuts for power users
   - Undo/redo for edit operations (future)

3. **Data Integrity**
   - Validate edits before saving
   - Sync updates to both databases (PostgreSQL + Cassandra)
   - Handle concurrent edits gracefully
   - Maintain audit trail (future enhancement)

4. **Security**
   - Verify user owns the batch
   - Sanitize inputs (prevent XSS/injection)
   - Rate limit edit operations
   - Log edit history for security

---

## Technical Design

### Database Schema

**PostgreSQL - batch_records table** (5 searchable fields):
```sql
id           UUID PRIMARY KEY
batchId      UUID (foreign key to batches)
fullName     VARCHAR (nullable)
workPhone    VARCHAR (nullable)
mobilePhone  VARCHAR (nullable)
email        VARCHAR (nullable)
businessName VARCHAR (nullable)
createdAt    TIMESTAMP
updatedAt    TIMESTAMP
```

**Cassandra - contact_records table** (complete vCard data - 30+ fields):
```cql
batch_record_id UUID PRIMARY KEY  -- Links to PostgreSQL batch_records.id
batch_id        UUID              -- Links to batch
created_at      TIMESTAMP
updated_at      TIMESTAMP

-- Personal info
full_name       TEXT
first_name      TEXT
last_name       TEXT

-- Contact methods
work_phone      TEXT
work_phone_ext  TEXT
mobile_phone    TEXT
email           TEXT

-- Personal address
address_street  TEXT
address_city    TEXT
address_state   TEXT
address_postal  TEXT
address_country TEXT

-- Social profiles
social_instagram TEXT
social_twitter   TEXT
social_facebook  TEXT

-- Business info
business_name    TEXT
business_title   TEXT
business_department TEXT
business_url     TEXT
business_hours   TEXT

-- Business address
business_address_street  TEXT
business_address_city    TEXT
business_address_state   TEXT
business_address_postal  TEXT
business_address_country TEXT

-- Professional profiles
business_linkedin TEXT
business_twitter  TEXT

-- Personal details
personal_url      TEXT
personal_bio      TEXT
personal_birthday TEXT

-- Extra fields
extra             MAP<TEXT, TEXT>
```

---

### API Endpoints

#### 1. GET `/api/batches/:batchId/records` - List Records
**Description:** Retrieve all records for a specific batch with full vCard data

**Query Parameters:**
```typescript
{
  page?: number;          // Page number (default: 1)
  pageSize?: number;      // Items per page (default: 50, max: 500)
  search?: string;        // Full-text search across all fields
  fields?: string[];      // Fields to return (default: all)
}
```

**Response:**
```typescript
{
  batchId: string;
  batchFileName: string;
  batchStatus: BatchStatus;
  records: Array<{
    id: string;  // batch_record_id
    // All Cassandra fields
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    workPhone: string | null;
    workPhoneExt: string | null;
    mobilePhone: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressPostal: string | null;
    addressCountry: string | null;
    socialInstagram: string | null;
    socialTwitter: string | null;
    socialFacebook: string | null;
    businessName: string | null;
    businessTitle: string | null;
    businessDepartment: string | null;
    businessUrl: string | null;
    businessHours: string | null;
    businessAddressStreet: string | null;
    businessAddressCity: string | null;
    businessAddressState: string | null;
    businessAddressPostal: string | null;
    businessAddressCountry: string | null;
    businessLinkedin: string | null;
    businessTwitter: string | null;
    personalUrl: string | null;
    personalBio: string | null;
    personalBirthday: string | null;
    extra: Record<string, string> | null;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
```

**Data Source:**
- Batch metadata from PostgreSQL
- Full record data from Cassandra (by batch_id)
- Client-side filtering for search (or server-side with Cassandra queries)

**Authentication:** Required (verify userId owns batch)

#### 2. GET `/api/batches/:batchId/records/:recordId` - Get Single Record
**Description:** Retrieve complete details for a single record

**Response:**
```typescript
{
  id: string;
  batchId: string;
  // All fields from Cassandra contact_records
  ...
}
```

**Authentication:** Required (verify userId owns batch)

#### 3. PUT `/api/batches/:batchId/records/:recordId` - Update Record
**Description:** Update record details in both PostgreSQL and Cassandra

**Request Body:**
```typescript
{
  // Any fields from vCard schema
  firstName?: string;
  lastName?: string;
  email?: string;
  workPhone?: string;
  mobilePhone?: string;
  businessTitle?: string;
  // ... any other editable fields
}
```

**Response:**
```typescript
{
  success: boolean;
  record: {
    // Updated record with all fields
  };
}
```

**Side Effects:**
- Updates `fullName`, `workPhone`, `mobilePhone`, `email`, `businessName` in PostgreSQL batch_records (searchable fields)
- Updates ALL fields in Cassandra contact_records
- Sets `updated_at` timestamp

**Validation:**
- Email format validation
- Phone number format (optional)
- Required fields check
- Sanitize HTML/XSS

**Authentication:** Required (verify userId owns batch)

#### 4. DELETE `/api/batches/:batchId/records/:recordId` - Delete Record
**Description:** Delete a single record from both databases

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Side Effects:**
- Deletes from PostgreSQL batch_records
- Deletes from Cassandra contact_records
- Updates batch record counts

**Authentication:** Required (verify userId owns batch)

#### 5. POST `/api/batches/:batchId/records/:recordId/export` - Export Record
**Description:** Export record as vCard (.vcf) file

**Response:** vCard file download
```
Content-Type: text/vcard
Content-Disposition: attachment; filename="John_Doe.vcf"

BEGIN:VCARD
VERSION:3.0
FN:John Doe
N:Doe;John;;;
EMAIL:john@example.com
TEL;TYPE=WORK:555-1234
...
END:VCARD
```

**Authentication:** Required (verify userId owns batch)

---

### Frontend Structure

```
front-cards/features/batch-records/
├── components/
│   ├── RecordsList.tsx              # Main list/table component
│   ├── RecordCard.tsx               # Individual record card (list view)
│   ├── RecordRow.tsx                # Table row (table view)
│   ├── RecordEditModal.tsx          # Edit modal/drawer
│   ├── RecordEditForm.tsx           # Form with all fields
│   ├── RecordDeleteDialog.tsx       # Confirmation dialog
│   ├── RecordPreview.tsx            # vCard preview modal
│   ├── RecordSearch.tsx             # Search bar component
│   ├── RecordFilters.tsx            # Filter controls
│   ├── RecordBulkActions.tsx        # Bulk operation toolbar
│   ├── RecordEmptyState.tsx         # Empty state UI
│   └── RecordFieldGroup.tsx         # Grouped form fields (personal, business, etc.)
├── hooks/
│   ├── useRecords.ts                # Fetch records hook
│   ├── useRecordEdit.ts             # Edit record hook
│   ├── useRecordDelete.ts           # Delete record hook
│   ├── useRecordSearch.ts           # Search/filter state
│   └── useRecordExport.ts           # Export hook
├── services/
│   ├── batchRecordService.ts        # API service layer
│   └── vcardExporter.ts             # vCard export logic
├── utils/
│   ├── recordValidator.ts           # Input validation
│   ├── recordSearcher.ts            # Client-side search logic
│   └── fieldHelpers.ts              # Field formatting helpers
├── types/
│   └── index.ts                     # TypeScript interfaces
└── README.md                        # Feature documentation
```

---

### Backend Structure

```
api-server/src/features/batch-records/
├── controllers/
│   └── batchRecordController.ts     # Route handlers
├── services/
│   ├── batchRecordService.ts        # Business logic
│   └── vcardService.ts              # vCard generation
├── repositories/
│   ├── batchRecordRepository.ts     # PostgreSQL operations
│   └── contactRecordRepository.ts   # Cassandra operations
├── validators/
│   └── recordValidator.ts           # Input validation schemas
├── types.ts                         # TypeScript interfaces
├── routes.ts                        # API routes
└── README.md                        # Feature documentation
```

---

## Implementation Plan

### Phase 1: Backend Foundation (Day 1-2)

**Tasks:**
1. Create feature structure
2. Implement Cassandra repository (`contactRecordRepository.ts`)
   - `findRecordsByBatchId(batchId, pagination)` - Query Cassandra by batch_id index
   - `findRecordById(recordId)` - Direct lookup by batch_record_id (primary key)
   - `updateRecord(recordId, updates)` - Update Cassandra record
   - `deleteRecord(recordId)` - Delete from Cassandra
3. Implement PostgreSQL repository (`batchRecordRepository.ts`)
   - `updateSearchableFields(recordId, fields)` - Update 5 searchable fields
   - `deleteRecord(recordId)` - Delete from PostgreSQL
4. Implement service layer (`batchRecordService.ts`)
   - Coordinate PostgreSQL + Cassandra operations
   - Handle transactions/consistency
   - Implement full-text search logic
   - Generate vCard files
5. Implement controllers and routes
   - GET `/api/batches/:batchId/records`
   - GET `/api/batches/:batchId/records/:recordId`
   - PUT `/api/batches/:batchId/records/:recordId`
   - DELETE `/api/batches/:batchId/records/:recordId`
   - POST `/api/batches/:batchId/records/:recordId/export`

**Testing:**
- Unit tests for repositories
- Integration tests for API endpoints
- Test with sample data (different field combinations)

### Phase 2: Frontend Components (Day 3-4)

**Tasks:**
1. Create feature structure
2. Implement API service (`batchRecordService.ts`)
3. Implement hooks:
   - `useRecords` (fetch with pagination, search)
   - `useRecordEdit` (edit with optimistic updates)
   - `useRecordDelete` (delete with confirmation)
   - `useRecordSearch` (client-side search state)
4. Implement core components:
   - `RecordsList.tsx` (table with virtual scrolling)
   - `RecordCard.tsx` (expandable card view)
   - `RecordSearch.tsx` (search bar with debouncing)
5. Create page: `app/batches/[batchId]/records/page.tsx`

**Testing:**
- Component tests
- Search performance testing
- Accessibility testing

### Phase 3: Edit Functionality (Day 5-6)

**Tasks:**
1. Implement `RecordEditModal.tsx`
2. Implement `RecordEditForm.tsx` with field groups:
   - Personal information section
   - Contact methods section
   - Business information section
   - Address sections (personal & business)
   - Social profiles section
   - Additional fields section
3. Implement form validation:
   - Email format validation
   - Phone number formatting
   - Required field validation
4. Implement optimistic updates
5. Handle edit conflicts

**Testing:**
- Form validation tests
- Edit operation tests
- Concurrent edit handling tests

### Phase 4: Search & Filter (Day 7)

**Tasks:**
1. Implement client-side full-text search
   - Search across all 30+ fields
   - Debounced search (300ms)
   - Highlight matches in results
2. Implement filter options:
   - Has email
   - Has phone
   - Has business info
   - Missing fields
3. Implement filter UI
4. Optimize search performance (indexing, memoization)

**Testing:**
- Search performance benchmarks
- Filter combination tests
- Large dataset tests (1000+ records)

### Phase 5: Export & Preview (Day 8)

**Tasks:**
1. Implement vCard generation
   - Convert record to vCard 3.0 format
   - Handle all field types
   - Proper encoding
2. Implement record preview modal
3. Implement single record export
4. Implement bulk export (selected records)

**Testing:**
- vCard format validation
- Test exports with various clients (iOS, Android, Outlook)
- Encoding tests (special characters, emojis)

### Phase 6: Polish & Integration (Day 9-10)

**Tasks:**
1. Implement loading states (skeletons)
2. Implement error states
3. Implement empty states
4. Add keyboard shortcuts:
   - `/` to focus search
   - `Esc` to close modals
   - Arrow keys for navigation
5. Mobile responsive design
6. Performance optimization:
   - Virtual scrolling for large lists
   - Lazy loading on scroll
   - Image optimization
7. Accessibility improvements:
   - ARIA labels
   - Keyboard navigation
   - Screen reader support

**Testing:**
- End-to-end testing
- Performance testing
- Accessibility audit
- Cross-browser testing

---

## Data Flow

### Viewing Records

```
User navigates to /batches/:batchId/records
  ↓
RecordsList component mounts
  ↓
useRecords(batchId) hook → batchRecordService.getRecords(batchId)
  ↓
GET /api/batches/:batchId/records?page=1
  ↓
batchRecordController.listRecords()
  ↓
batchRecordService.getRecords(batchId, userId, pagination)
  ↓
1. Verify user owns batch (PostgreSQL)
2. contactRecordRepository.findByBatchId(batchId)
  ↓
Cassandra: SELECT * FROM contact_records WHERE batch_id = ? ALLOW FILTERING
  ↓
Return: { records: [...], pagination: {...} }
  ↓
Render: RecordCard/RecordRow components
```

### Editing a Record

```
User clicks Edit → RecordEditModal opens
  ↓
User modifies fields → clicks Save
  ↓
useRecordEdit hook → batchRecordService.updateRecord(batchId, recordId, updates)
  ↓
PUT /api/batches/:batchId/records/:recordId
  ↓
batchRecordController.updateRecord()
  ↓
batchRecordService.updateRecord(batchId, recordId, userId, updates)
  ↓
1. Validate inputs (email format, phone format, etc.)
2. Extract searchable fields (fullName, email, etc.)
3. batchRecordRepository.updateSearchableFields(recordId, searchableFields)
   → PostgreSQL: UPDATE batch_records SET ... WHERE id = ?
4. contactRecordRepository.updateRecord(recordId, allUpdates)
   → Cassandra: UPDATE contact_records SET ... WHERE batch_record_id = ?
5. Commit both updates
  ↓
Return: { success: true, record: {...} }
  ↓
Update UI optimistically → Show success message
```

### Searching Records

```
User types in search box (debounced 300ms)
  ↓
useRecordSearch hook updates search state
  ↓
Client-side filtering:
  - Convert all record fields to lowercase strings
  - Search for query substring in any field
  - Return matching records
  ↓
Re-render filtered RecordsList
```

---

## UI/UX Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Batches    batch-sample-01.txt                  [LOADED]│
│  2 records                                                          │
├─────────────────────────────────────────────────────────────────────┤
│  [Search across all fields...]           [Has Email ▼] [Export All]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ □  Sofia Rodríguez Oviedo                    [Edit] [Delete] │  │
│  │     srodriguez@code-cr.com                                   │  │
│  │     Work: 2459-7553  •  Mobile: 6018-7292                    │  │
│  │     Gestor Ehs at CODE S.A.                                  │  │
│  │                                                               │  │
│  │     [▼ Show all fields]                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ □  Rebeca Bonilla Vargas                     [Edit] [Delete] │  │
│  │     rbonilla@code-cr.com                                     │  │
│  │     Work: 2459-7549  •  Mobile: 8405-0496                    │  │
│  │     Ingeniera De Proyectos at CODE S.A.                      │  │
│  │                                                               │  │
│  │     [▼ Show all fields]                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Showing 2 of 2 records                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Edit Modal
```
┌─────────────────────────────────────────┐
│  Edit Contact - Sofia Rodríguez Oviedo  │
├─────────────────────────────────────────┤
│                                          │
│  Personal Information                    │
│  ┌────────────────────────────────────┐ │
│  │ First Name: Sofia                  │ │
│  │ Last Name:  Rodríguez Oviedo       │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Contact Methods                         │
│  ┌────────────────────────────────────┐ │
│  │ Email:       srodriguez@code-cr.com│ │
│  │ Work Phone:  2459-7553             │ │
│  │ Mobile:      6018-7292             │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Business Information                    │
│  ┌────────────────────────────────────┐ │
│  │ Company:     CODE S.A.             │ │
│  │ Title:       Gestor Ehs            │ │
│  │ Department:  [Empty]               │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [▼ Show more fields...]                │
│                                          │
│              [Cancel]  [Save Changes]   │
└─────────────────────────────────────────┘
```

---

## Success Criteria

- [ ] User can view all records from a batch
- [ ] Records display full vCard details from Cassandra
- [ ] Search works across all 30+ fields with < 200ms response
- [ ] User can edit any field in a record
- [ ] Edits save to both PostgreSQL (searchable fields) and Cassandra (all fields)
- [ ] User can delete records with confirmation
- [ ] User can export records as vCard files
- [ ] Virtual scrolling handles 1000+ records smoothly
- [ ] UI is responsive on desktop, tablet, and mobile
- [ ] Empty state displays when batch has no records
- [ ] Error states are handled gracefully
- [ ] Form validation prevents invalid data

---

## Dependencies

- ✅ Prisma schema with `batch_records` table (already exists)
- ✅ Cassandra `contact_records` table (already exists)
- ✅ Auth middleware (already exists)
- ✅ Batch upload feature (already exists)
- ✅ Batch view feature (to be implemented in parallel)
- ⏳ vCard field definitions from `vcardFields.ts`

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Large record sets (1000+) slow to load | Implement virtual scrolling, pagination, lazy loading |
| Client-side search on 1000+ records is slow | Use Web Workers for search, implement server-side search for very large batches |
| Cassandra queries by batch_id are slow | Ensure `idx_contact_records_batch_id` index exists, add caching layer |
| Concurrent edits cause conflicts | Implement optimistic locking with `updated_at` timestamp checks |
| Syncing PostgreSQL + Cassandra fails partially | Implement transaction-like behavior, rollback on failure |
| vCard export fails for complex fields | Thoroughly test vCard generation, handle edge cases |

---

## Future Enhancements

- **Phase 2 Features:**
  - Bulk edit (update common fields for multiple records)
  - Bulk delete with selection
  - Import from vCard/CSV to add records
  - Merge duplicate records
  - Record history/audit trail
  - Undo/redo for edits

- **Advanced Features:**
  - AI-powered data enrichment (fetch missing business info)
  - Smart duplicate detection
  - Data validation suggestions
  - Export to CRM formats (Salesforce, HubSpot)
  - Email integration (send emails to contacts)
  - SMS integration (send texts to contacts)

---

## Notes

- This feature queries Cassandra for full record data (30+ fields)
- PostgreSQL is only updated for searchable fields (5 fields) during edits
- Search can be client-side for < 500 records, server-side for larger batches
- Ensure consistent field naming with `vcardFields.ts`
- Consider implementing GraphQL for flexible field selection in future
- vCard export format must be compatible with major platforms (iOS, Android, Outlook)

---

**Created:** 2025-11-26
**Last Updated:** 2025-11-26
**Author:** Feature-Worker Agent
