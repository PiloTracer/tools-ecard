# Feature Documentation Generation Prompt

Use this prompt to generate standardized feature documentation for any project.

---

## Prompt

```
You are tasked with generating comprehensive feature documentation for this project.

## Objective

Traverse the entire codebase, identify all features, and create standardized documentation under `.claude/features/`.

## Steps

### 1. Explore the Codebase Structure

First, understand the project:

1. Read the root-level context files if they exist:
   - `DOCS_CONTEXT.md` or `README.md`
   - `docker-compose.yml` or `docker-compose.dev.yml`
   - `package.json` (root and in each service)

2. Identify all services/apps in the project:
   - List all top-level directories that are services (e.g., `front-*`, `back-*`, `api-*`, `app/`, `src/`)
   - Note the tech stack for each (Remix, Next.js, FastAPI, Express, etc.)

3. Find where features live in each service:
   - Look for `features/`, `modules/`, `domains/` directories
   - Check `app/features/`, `src/features/`, or similar patterns
   - Note any existing `feature.yaml` files

### 2. Identify All Features

For each service, list all features found:

```
Service: [service-name]
Features found:
- feature-1 (path: /service/features/feature-1)
- feature-2 (path: /service/features/feature-2)
```

Create a master list of unique features across all services.

### 3. Analyze Each Feature

For each feature, gather:

**Business Context (for README.md):**
- What does this feature do? (read code, comments, existing docs)
- Who uses it? (user types, roles)
- Key workflows or user stories
- Dependencies on other features (if any)

**Technical Mapping (for feature.yaml):**
- Which services implement this feature?
- For each service, document:
  - Routes/endpoints (paths, methods)
  - Components (UI files)
  - Hooks (React hooks)
  - Services (business logic)
  - Controllers (request handlers)
  - Repositories (data access)
  - Models/Types (data structures)
  - Database tables (if identifiable)

### 4. Create Feature Documentation

For each feature, create:

**`.claude/features/{feature-name}/README.md`**

```markdown
# {Feature Name}

Brief description of what this feature does.

## Overview

1-2 paragraphs explaining the feature's purpose and value.

## User Stories

- As a [user type], I can [action] so that [benefit]
- ...

## Key Workflows

1. **Workflow Name**: Brief description
2. ...

## Dependencies

- Depends on: [other features, if any]
- Used by: [features that depend on this, if any]

## Notes

Any important implementation notes or constraints.
```

**`.claude/features/{feature-name}/feature.yaml`**

```yaml
name: feature-name
description: Brief one-liner description

services:
  service-name-1:
    routes:
      - path/to/route1.tsx
      - path/to/route2.tsx
    components:
      - path/to/Component1.tsx
      - path/to/Component2.tsx
    hooks:
      - path/to/useHook1.ts
    services:
      - path/to/service1.ts
    types:
      - path/to/types.ts

  service-name-2:
    endpoints:
      - method: GET
        path: /api/resource
        file: path/to/endpoint.py
      - method: POST
        path: /api/resource
        file: path/to/endpoint.py
    services:
      - path/to/service.py
    repositories:
      - path/to/repository.py
    models:
      - path/to/models.py

database:
  tables:
    - table_name_1
    - table_name_2

dependencies:
  features:
    - other-feature-name
  external:
    - external-service-or-api
```

### 5. Update Index Files

After creating all feature docs, update these files:

**`.claude/FEATURES_INDEX.md`**

```markdown
# Features Index

Quick reference for all documented features.

## Features

| Feature | Services | Description |
|---------|----------|-------------|
| [feature-1](features/feature-1/) | service-a, service-b | Brief description |
| [feature-2](features/feature-2/) | service-a | Brief description |
...

## By Service

### service-a
- feature-1
- feature-2

### service-b
- feature-1
- feature-3
```

**`.claude/FEATURE_STANDARD.md`** - Update if needed to match project conventions

**`.claude/FEATURE_DOCUMENTATION_SUMMARY.md`** - Update with actual features found

### 6. Update Agent Files

Check each agent file in `.claude/agents/` and ensure they have:

```markdown
## Feature Documentation

When working on a feature, ALWAYS check `.claude/features/{feature-name}/` first:
- `README.md` - What the feature does (business logic, user stories)
- `feature.yaml` - Where to find code (paths across all services)

This tells you exactly which files to modify without searching the codebase.
```

Also update any project-specific references:
- Service names
- Tech stack (Remix vs Next.js, FastAPI vs Express, etc.)
- Port numbers
- Database types
- Development commands

### 7. Update DIRECTORY_MAP.md

Ensure `.claude/DIRECTORY_MAP.md` accurately reflects the project's `.claude/` structure.

## Output Requirements

1. Create all feature directories under `.claude/features/`
2. Each feature must have both `README.md` and `feature.yaml`
3. Update `FEATURES_INDEX.md` with all features
4. Update agent files with correct project context
5. Provide a summary of:
   - Total features documented
   - Services covered
   - Any issues or gaps found

## Quality Checklist

- [ ] All features across all services identified
- [ ] Each feature has README.md with clear description
- [ ] Each feature has feature.yaml with accurate paths
- [ ] Paths in feature.yaml are verified to exist
- [ ] FEATURES_INDEX.md lists all features
- [ ] Agent files updated with project-specific context
- [ ] No placeholder or template text remaining

## Important Notes

- DO NOT modify any code files
- Only create/update documentation in `.claude/`
- Use relative paths from project root in feature.yaml
- Keep README.md focused on WHAT (business logic)
- Keep feature.yaml focused on WHERE (file paths)
- Be thorough - check ALL services for feature implementations
- Verify paths exist before adding to feature.yaml
```

---

## Usage

1. Copy this prompt to your clipboard
2. Open Claude Code in the target project
3. Paste the prompt
4. Let the agent traverse and document

## After Generation

Verify the output:
1. Check `.claude/features/` has all expected features
2. Spot-check a few `feature.yaml` files - paths should be valid
3. Review `FEATURES_INDEX.md` for completeness
4. Test by asking an agent to work on a feature - it should find the docs
