# Simple Projects Feature

## Overview
Multi-project support for organizing templates and batches into logical containers.

## API Endpoints

- `GET /api/v1/projects` - Get all projects for authenticated user
- `POST /api/v1/projects` - Create a new project
- `GET /api/v1/projects/selected` - Get currently selected project
- `PUT /api/v1/projects/selected` - Update selected project
- `POST /api/v1/projects/ensure-default` - Ensure user has default project

## Database Schema

### Users Table
- `id` - UUID primary key
- `email` - User email (unique)
- `name` - User display name
- `oauth_id` - OAuth provider ID

### Projects Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `name` - Project name
- `is_default` - Boolean flag for default project
- `created_at` - Timestamp
- `updated_at` - Timestamp

### User Project Selections Table
- `user_id` - Foreign key to users (primary key)
- `project_id` - Foreign key to projects
- `selected_at` - Timestamp

## Business Logic

1. **Auto-provisioning**: On first login, automatically create a default project
2. **Project Selection**: Persists across sessions via localStorage and backend
3. **Name Validation**: Project names must be unique per user
4. **Default Project**: Every user has one default project that cannot be deleted

## Testing

```bash
# Run unit tests
npm test

# Test API endpoints
curl http://localhost:7400/api/v1/projects
```

## Future Enhancements

- Project deletion (non-default only)
- Project renaming
- Project archiving
- Project sharing between users
- Project-level settings