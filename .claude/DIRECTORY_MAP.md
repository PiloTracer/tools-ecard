# .claude Directory Map

This document describes the purpose of each **`.claude/`** subdirectory and how it relates to the **tools-ecards** monorepo.

**Repository (application code — not in `.claude/`):**

| Path | App / role |
|------|------------|
| `front-cards/` | Next.js 16 UI |
| `api-server/` | Fastify + Prisma API |
| `render-worker/` | Background jobs |
| `db/` | Postgres and Cassandra init scripts |
| `packages/` | Shared types / packages |

---

## Directory purposes (`.claude/`)

### `agents/`
Agent role definitions and capabilities. Each agent type has specific skills and contexts.
- **Place here**: New agent definitions (e.g., `agent-python.md`, `db-worker.md`)

### `features/`
Feature-specific documentation, specs, and resources. Each feature gets its own subdirectory.
- **Place here**: Feature specs, user stories, technical designs, screenshots, SQL seeds
- **Structure**: `features/{feature-name}/` (e.g., `features/app-library/`, `features/user-management/`)

### `plans/`
Implementation plans and roadmaps. Created before starting work on a feature or major task.
- **Place here**: New plans, phase breakdowns, status tracking documents
- **Naming**: `{feature-name}.md` or `{feature-name}-{phase}.md`

### `implementations/`
Records of completed implementations. Created after finishing a feature or significant work.
- **Place here**: Implementation summaries, what was built, decisions made
- **Naming**: `{FEATURE_NAME}_IMPLEMENTATION.md` or `PHASE_{N}_{FEATURE}_{DATE}.md`

### `fixes/`
Bug fix documentation and error resolutions.
- **Place here**: Error analysis, fix descriptions, regression notes
- **Naming**: `{feature}-{issue}.md` or `ERROR_FIXES_{DATE}.md`

### `prompts/`
Pre-written conversation starters for resuming work on specific features.
- **Place here**: Context prompts to quickly onboard to a feature
- **Naming**: `{feature-name}-starter.md`

### `decisions/`
Architectural decision records (ADRs) explaining why choices were made.
- **Place here**: Design decisions, trade-off analysis, rationale
- **Naming**: `ADR-{number}-{title}.md`

---

## Root-level files in `.claude/`

| File | Purpose |
|------|---------|
| `CONVENTIONS.md` | Engineering conventions (TS, Prisma, logging, Docker) |
| `FEATURE_STANDARD.md` | How to write `features/{name}/README.md` and `feature.yaml` |
| `FEATURES_INDEX.md` | High-level feature catalog |
| `README.md` | How to use this directory |
| `SESSION_STARTERS.md` | Short copy-paste session templates |
| `settings.local.json` | Local tool settings (if present) |

**Repo root** (outside `.claude/`): `DOCS_TECH_STACK.md`, `DOCS_CONTEXT.md`, `CONTEXT.md`, `README.md`.

---

## Quick Reference

| Task | Directory |
|------|-----------|
| Creating a plan | `plans/` |
| Documenting a completed feature | `implementations/` |
| Writing feature specs | `features/{name}/` |
| Recording a bug fix | `fixes/` |
| Adding an agent role | `agents/` |
| Writing a session starter | `prompts/` |
| Recording a design decision | `decisions/` |
