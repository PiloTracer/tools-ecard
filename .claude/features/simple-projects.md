# Feature: Simple Projects

## Overview
The simple-projects feature provides multi-project support for users, allowing them to organize their cards and templates into different projects. Each user gets a default project automatically created on first login, and can create additional projects as needed.

## Core Requirements

### Database Schema
- **Users table**: Track users with id, email, name, etc.
- **Projects table**: Store projects with id, name, user_id, is_default flag
- **User-Project association**: Link users to their projects
- **Project selection persistence**: Track selected project per user session

### Backend Logic
1. **Auto-provisioning on first login**:
   - Create user record if not exists
   - Create default project named "default"
   - Associate user with default project
   - Set default project as selected

2. **API Endpoints**:
   - `GET /api/projects` - Get all projects for authenticated user
   - `POST /api/projects` - Create new project
   - `GET /api/projects/selected` - Get currently selected project
   - `PUT /api/projects/selected` - Update selected project

### Frontend UI
1. **Project Selection Dropdown**:
   - Position: Right above "Quick Actions" section in dashboard
   - Shows all user's projects
   - Current selection persisted in localStorage
   - Default to "default" project on first login

2. **Project Management**:
   - Add new project button/inline option
   - New projects automatically appear in dropdown
   - Selected project persists across page reloads

## Technical Implementation

### Database Schema (PostgreSQL)

```sql
-- Users table (extend existing or create new)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    oauth_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- User selected project (session tracking)
CREATE TABLE IF NOT EXISTS user_project_selections (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_is_default ON projects(is_default);
```

### API Contracts

#### Get User Projects
```typescript
// GET /api/projects
interface GetProjectsResponse {
  projects: Array<{
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  selectedProjectId: string | null;
}
```

#### Create Project
```typescript
// POST /api/projects
interface CreateProjectRequest {
  name: string;
}

interface CreateProjectResponse {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### Get Selected Project
```typescript
// GET /api/projects/selected
interface GetSelectedProjectResponse {
  projectId: string;
  project: {
    id: string;
    name: string;
    isDefault: boolean;
  };
}
```

#### Update Selected Project
```typescript
// PUT /api/projects/selected
interface UpdateSelectedProjectRequest {
  projectId: string;
}

interface UpdateSelectedProjectResponse {
  success: boolean;
  projectId: string;
}
```

### Frontend Components

#### ProjectSelector Component
- Dropdown component positioned above Quick Actions
- Loads projects on mount
- Persists selection to localStorage
- Syncs with backend on selection change

#### AddProjectModal Component
- Simple modal/inline form for project name
- Validates uniqueness
- Auto-selects new project after creation

## Feature Dependencies
- Authentication (user must be logged in)
- PostgreSQL database
- API authentication middleware

## Testing Requirements
1. Auto-creation of default project on first login
2. Project creation with duplicate name prevention
3. Project selection persistence across sessions
4. UI dropdown functionality
5. localStorage sync with backend state

## Migration Strategy
For existing users (if any):
1. Create default project for all existing users
2. Associate all existing templates/batches with default project
3. Set default project as selected for all users

## Security Considerations
- Users can only access their own projects
- Project names sanitized to prevent XSS
- Rate limiting on project creation (max 100 projects per user)
- JWT authentication required for all endpoints

## Performance Targets
- Project list loading: <100ms
- Project creation: <200ms
- Project selection update: <50ms
- Frontend dropdown render: <50ms

## Future Enhancements (Not in scope)
- Project sharing between users
- Project archiving
- Project templates
- Project-level settings/preferences