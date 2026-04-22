# Feature documentation standard

This document defines the **standardized structure** for feature documentation in **tools-ecards** (E-Cards monorepo).

## Why centralized feature documentation?

Features span **`front-cards`**, **`api-server`**, and sometimes **`render-worker`** (and shared `packages/`). The **`.claude/features/{name}/`** tree is the **single place** for business context and cross-service file maps (`README.md` + `feature.yaml`), so agents and humans do not have to guess where behavior lives.

## Directory Structure

```
.claude/features/
├── FEATURE_STANDARD.md (this file)
├── {feature-name}/
│   ├── README.md
│   ├── feature.yaml
│   └── [optional: supporting docs]
```

## File Purposes

### README.md - What the Feature Does

**Purpose**: Business-level documentation focused on functionality, not code locations.

**Content**:
- Feature description (1-2 sentence overview)
- User stories / use cases
- Business requirements
- Key workflows
- Security & compliance considerations
- Performance targets
- Testing strategy (high-level)
- Known limitations or TODOs

**Example Structure**:
```markdown
# Feature: Progressive Profiling

## Overview
Gradual data collection from users during registration and onboarding...

## User Stories
- As a user, I want to provide my profile information gradually
- As an admin, I want to understand user data patterns...

## Key Workflows
1. User sees progressive profiling modal during registration
2. User can skip or complete each profile field
3. Data is saved incrementally...

## Security Considerations
- PII data is encrypted at rest
- GDPR compliance for data retention
```

### feature.yaml - Where the Feature Lives

**Purpose**: Technical mapping of code locations across all services.

**Content**:
- Feature metadata (name, version, description)
- Service implementations with file paths
- Database tables/schemas
- API endpoints
- External dependencies
- Configuration/environment variables

**Example Structure**:
```yaml
name: feature-name
version: 1.0.0
description: One-line feature description

services:
  front-public:
    routes:
      - path: /path/to/route
        file: app/features/feature-name/routes/file.tsx
    components:
      - ui/Component.tsx
    hooks:
      - hooks/useFeature.ts
    services:
      - services/featureService.ts

  front-admin:
    routes: [...]
    components: [...]

  back-api:
    endpoints:
      - path: /api/endpoint
        file: features/feature-name/controllers/handler.ts
    services:
      - features/feature-name/services/service.ts
    models:
      - features/feature-name/models/model.py

  back-auth:
    # Similar structure

  shared:
    contracts:
      - contracts/feature-name/feature.yaml
    types:
      - types/feature-name.ts

database:
  postgres:
    tables:
      - table_name: Schema/description
  cassandra:
    tables:
      - table_name: Schema/description

external_dependencies:
  - package_name@version

configuration:
  environment_variables:
    - VAR_NAME: Description
  feature_flags:
    - flag_name: Default value

links:
  planning_docs:
    - .claude/features/{feature-name}/README.md
  implementation_docs:
    - Service-specific feature.yaml files
  prompts:
    - .claude/prompts/{feature-name}-starter.md
  plans:
    - .claude/plans/{feature-name}-*.md
```

## How to Use These Files

### For Feature Planning (Feature Workers)
1. Read `README.md` to understand **what** the feature does
2. Use `feature.yaml` to identify all code locations
3. Navigate to specific files using paths in `feature.yaml`
4. Refer to service-specific `feature.yaml` files for detailed endpoint/component specs

### For Code Navigation (Any Agent)
1. Know the feature name? Go to `.claude/features/{feature-name}/`
2. Need a quick overview? Read `README.md`
3. Looking for specific code? Check `feature.yaml` for file paths
4. Need detailed API specs? Check `back-api/features/{feature-name}/feature.yaml`

### For Adding New Features
1. Create `.claude/features/{feature-name}/README.md` with business description
2. Create `.claude/features/{feature-name}/feature.yaml` with complete path mapping
3. Include links to service-specific `feature.yaml` files in the "implementation_docs" section
4. Keep both files updated as the feature grows

## Maintenance Guidelines

### Keep README.md Updated When
- Business requirements change
- User workflows change
- Security/compliance rules change
- Performance targets change

### Keep feature.yaml Updated When
- New code files are added to the feature
- Code is moved between services
- Database schema changes
- New endpoints are added
- Dependencies are added/removed

### Service-Specific feature.yaml Files
- Each service maintains its own `feature.yaml` in the feature directory
- These are the source of truth for detailed specs (exact paths, endpoint details, etc.)
- Centralized `feature.yaml` is a summary/index pointing to these

## Example: Auto-Auth Feature

The auto-auth feature is implemented across multiple services:

```
.claude/features/auto-auth/
├── README.md (business description)
├── feature.yaml (centralized mapping)

back-api/features/auto-auth/
├── feature.yaml (API endpoints & services)
├── controllers/
├── services/

back-auth/features/auto-auth/
├── feature.yaml (auth logic details)
├── routes/
├── services/

front-public/app/features/auto-auth/
├── feature.yaml (frontend route & components)
├── routes/
├── hooks/

shared/contracts/auto-auth/
├── feature.yaml (contract specs)
```

## Navigation Commands

```bash
# Find all features
ls -la .claude/features/

# Understand a feature
cat .claude/features/{feature-name}/README.md

# Find where code is
cat .claude/features/{feature-name}/feature.yaml

# Go to specific service implementation
cat back-api/features/{feature-name}/feature.yaml
```

## FAQ

### Q: Should I update the service-specific feature.yaml or the central one?
A: Update both. The service-specific file is the source of truth for details, the central file is a summary/index.

### Q: What if a feature only exists in one service?
A: Still create the centralized documentation. It standardizes the approach and makes future expansion easier.

### Q: Can I use different fields in feature.yaml?
A: Yes, but stick to the suggested structure. Add custom fields as needed for your feature, but include the basic metadata fields (name, version, description, services).

### Q: How detailed should the README.md be?
A: Detailed enough for a non-engineer to understand what the feature does and for an engineer to understand the business context before diving into code.

---

Last Updated: November 28, 2025
