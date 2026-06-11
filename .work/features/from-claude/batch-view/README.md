# Batch view

UI for **listing batches**, **filters/search**, **stats**, **delete**, and navigation into **batch records**. HTTP calls go to **api-server** via `apiClient` (`NEXT_PUBLIC_API_URL`) on the **`/api/batches`** prefix.

## Overview (frontend)

- **Pages:** `app/batches/page.tsx`, `app/batches/[batchId]/records/page.tsx` (records page is owned by **batch-records** UX but lives under `/batches`).
- **Data layer:** `features/batch-view/services/batchViewService.ts` — `GET/DELETE /api/batches/...`, `GET /api/batches/stats`.

## Overview (api-server)

**Live:** **`batch-upload`** is registered on **`/api/batches`** and implements list, upload, status, retry, stats, recent, delete, and **`GET /api/batches/:id`** returning **`{ batch }`** (Prisma row + Cassandra record count) for the batch-view client.

**Alternate module:** **`batch-view`** (`batch-view/routes.fastify.ts`) is **not** registered; kept as reference or for a future merge. Do not register both on the same prefix without deduplicating handlers.

## User stories

- As a user, I want to see all batches for my account with pagination and filters.
- As a user, I want to open a batch and edit records.

## Dependencies

- **batch-upload** (live API for list, stats, delete, upload, status, **batch detail**).
- **batch-records** (per-batch record UI and `GET/PUT/DELETE` records under `/api/batches/:batchId/records`).
- **simple-projects** (project context used elsewhere in the app flow).
