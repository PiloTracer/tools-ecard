# Simple quick actions

Dashboard **Quick Actions** card: shortcuts to open the template designer, import a batch (embedded upload), and view batches. Actions are **disabled** until a project is selected (`useProjects` from **simple-projects**).

## Overview

Single presentational/feature module consumed by `app/dashboard/page.tsx`. It composes **batch-upload** (`UploadBatchComponent`) and does not define its own API routes.

## User stories

- As a user, I want one place on the dashboard to start common tasks.
- As a user, I want clear feedback when I must pick a project first.

## Dependencies

- **simple-projects:** `useProjects` for `selectedProjectId` and loading state.
- **batch-upload:** `UploadBatchComponent` for the import action.
- **Parent page:** supplies `onCreateTemplate` and `onViewBatches` navigation callbacks.

## Testing

- `features/simple-quick-actions/components/QuickActions.test.tsx` — component tests for QuickActions.
