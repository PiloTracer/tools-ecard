# Simple Projects Feature

Multi-project workspace management for organizing templates and batches.

## Overview

Enables users to organize their templates and batches into logical project containers. Auto-provisions default project on first login with persistent project selection.

## User Stories

- As a user, I want to organize my work into separate projects
- As a user, I want one default project created automatically
- As a user, I want my project selection to persist across sessions
- As a user, I want to switch between projects easily

## Key Workflows

### 1. Auto-Provision Default Project
1. User logs in for first time
2. System checks for existing projects
3. If none exist, create "Default Project"
4. Set as selected project
5. Store selection in database and localStorage

### 2. Switch Projects
1. User selects different project from dropdown
2. Frontend updates localStorage
3. Backend updates user_project_selections table
4. UI reloads with new project context
5. All templates/batches filtered by selected project

## Dependencies

- **Used by:** template-textile, batch-upload

## Security Considerations

- Users can only access their own projects
- Project names validated for uniqueness per user
- Default project cannot be deleted

## Configuration

- Auto-provisioning enabled by default
- Default project name: "Default Project"
