# Features Directory

**Purpose:** Detailed specifications for E-Cards features. Read on-demand, not all at once.

## Directory Contents

Each feature has one or more markdown files:
- `{feature-name}.md` - E-Cards implementation specification
- `{feature-name}.external.md` - External system requirements (if applicable)

## Feature List

| Feature | Status | Priority | Files |
|---------|--------|----------|-------|
| **Auto-Auth** | In Progress | **HIGH** | `auto-auth.md`, `auto-auth.external.md` |
| **Database Setup** | Planned | **HIGH** | `database-setup.md` |
| **Template Designer** | Planned | **HIGH** | `template-designer.md` |
| **Batch Import** | Planned | **HIGH** | `batch-import.md` |
| **Render Worker** | Planned | **HIGH** | `render-worker.md` |
| **Batch Management** | Planned | MEDIUM | `batch-management.md` |
| **Name Parser** | Planned | MEDIUM | `name-parser.md` |
| **User Profile** | Planned | LOW | `user-profile.md` |

## Development Sequence

See [`feature-order.md`](./feature-order.md) for the recommended implementation order with dependencies.

## Usage

**Load only what you need:**

```bash
# Working on auto-auth
Read: .claude/features/auto-auth.md

# Need external API specs
Read: .claude/features/auto-auth.external.md

# Planning implementation order
Read: .claude/features/feature-order.md
```

## Feature Specification Structure

Each `*.md` file includes:
1. User Story & Acceptance Criteria
2. Architecture & Data Flow
3. API Endpoints (request/response)
4. Database Schema
5. Security & Error Handling
6. Testing Strategy

**Principle:** Detailed specs here. High-level overview in `/CONTEXT.md`.
