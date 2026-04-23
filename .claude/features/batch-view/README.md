# Batch view

UI for **listing batches**, **filters/search**, **stats**, **delete**, and navigation into **batch records**. HTTP calls go to **api-server** via `apiClient` (`NEXT_PUBLIC_API_URL`) on the **`/api/batches`** prefix.

## Overview (frontend)

- **Pages:** `app/batches/page.tsx`, `app/batches/[batchId]/records/page.tsx` (records page is owned by **batch-records** UX but lives under `/batches`).
- **Data layer:** `features/batch-view/services/batchViewService.ts` — `GET/DELETE /api/batches/...`, `GET /api/batches/stats`.

## Overview (api-server)

There are **two** implementations under `api/batches`:

| Module | Registered in `app.ts` | Role |
|--------|-------------------------|------|
| **batch-upload** (`routes.fastify.ts`) | **Yes** | Upload, list, `/:id/status`, delete, retry, `stats`, `recent` |
| **batch-view** (`batch-view/routes.fastify.ts`) | **No** | Would expose list, `stats`, **`GET /:batchId` (detail)**, delete — overlaps list/stats/delete with batch-upload |

Today only **batch-upload** is mounted on `/api/batches`. The **batch-view** Fastify plugin is **legacy / alternate** and is not registered; **`GET /api/batches/:batchId` (full detail)** is not provided by batch-upload routes (only **`GET /api/batches/:id/status`**). If batch detail fetch fails at runtime, align by registering non-conflicting routes or extending batch-upload.

## User stories

- As a user, I want to see all batches for my account with pagination and filters.
- As a user, I want to open a batch and edit records.

## Dependencies

- **batch-upload** (live API for list, stats, delete, upload, status).
- **batch-records** (per-batch record UI and `GET/PUT/DELETE` records under `/api/batches/:batchId/records`).
- **simple-projects** (project context used elsewhere in the app flow).
