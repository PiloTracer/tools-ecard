# Simple Projects Feature - Frontend

## Overview
Frontend components and hooks for multi-project support in the E-Cards application.

## Components

### ProjectSelector
Main dropdown component for selecting and creating projects.

**Usage:**
```tsx
import { useAuth } from '@/features/auth';
import { ProjectSelector, ProjectsProvider } from '@/features/simple-projects';

function Dashboard() {
  const { user } = useAuth();
  return (
    <ProjectsProvider sessionUserId={user?.id}>
      <div>
        <ProjectSelector />
      </div>
    </ProjectsProvider>
  );
}
```

## Hooks

### useProjects

Use **`import { useProjects, ProjectsProvider } from '@/features/simple-projects'`** and render **`ProjectsProvider`** above any component that calls **`useProjects()`**. Pass **`sessionUserId={user?.id}`** from auth so the provider can reload after logout / re-login without importing auth internally. State and API calls live in **`contexts/ProjectsContext.tsx`** (there is no separate standalone hook file).

**Usage:**

```tsx
import { useAuth } from '@/features/auth';
import { ProjectsProvider, useProjects } from '@/features/simple-projects';

function Shell() {
  const { user } = useAuth();
  return (
    <ProjectsProvider sessionUserId={user?.id}>
      <ChildThatCallsUseProjects />
    </ProjectsProvider>
  );
}
```
```tsx
import { useProjects } from '@/features/simple-projects';

function MyComponent() {
  const {
    projects,
    selectedProjectId,
    selectedProject,
    loading,
    error,
    createProject,
    selectProject,
    reloadProjects,
    ensureDefaultProject
  } = useProjects();

  // Use project data...
}
```

## Features

1. **Project Selection**: Dropdown shows all user projects with current selection
2. **Create New Project**: Inline creation with validation
3. **Persistence**: Selected project persists in localStorage
4. **Auto-sync**: Syncs with backend on selection change
5. **Default Project**: Ensures user always has at least one project

## API Integration

The feature communicates with the following backend endpoints:
- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/selected`
- `PUT /api/v1/projects/selected`
- `POST /api/v1/projects/ensure-default`

## Styling

Uses Tailwind CSS classes for consistent styling with the rest of the application.

## Error Handling

- Displays error messages for failed operations
- Validates project names before submission
- Handles duplicate project names gracefully

## Testing

```bash
# Run component tests
npm test

# Test in development
npm run dev
```