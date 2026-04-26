# .claude Directory

This directory contains Claude Code project-specific context and documentation.

## Structure

```
.claude/
├── README.md              # This file - directory overview
├── SESSION_STARTERS.md    # Quick-start prompts for new sessions
├── tutorials/             # Setup guides: E-Cards+Tools Dashboard storage; generic Seaweed S3 for other apps
└── features/              # Feature specifications
    ├── README.md          # Feature directory purpose
    ├── feature-order.md   # Development sequence guide
    ├── auto-auth.md       # Auto-auth feature spec
    └── auto-auth.external.md  # External systems requirements
```

## Purpose

**Keep context minimal.** This directory provides just enough information to start productive Claude Code sessions without overwhelming the token budget.

### What Goes Here

- **SESSION_STARTERS.md**: Copy-paste templates to start sessions quickly
- **features/**: Detailed specs for individual features (read on-demand)
- **Outside `.claude/`:** `DOCS_CONTEXT.md` (broad), `README.md` (quick start)

### What doesn't go here

- General one-command setup: **`README.md`** and **`DOCS_TECH_STACK.md`**
- Long architecture and integrations: **`DOCS_CONTEXT.md`**
- Session resume and minimal pointers: **`CONTEXT.md`**, **`.ai/context/HANDOFF.md`**
- Implementation code: stays under `front-cards/`, `api-server/`, `render-worker/`, etc.

## Usage

### Starting a New Session

1. **General Work**: Copy template from SESSION_STARTERS.md → "General Project Session"
2. **Feature Work**: Copy feature-specific template from SESSION_STARTERS.md
3. **Feature Deep Dive**: Reference specific `.claude/features/*.md` file

### Reading order

1. **`CONTEXT.md`** (repo root) or **`DOCS_TECH_STACK.md`** for stack and Docker
2. **Feature work:** `.claude/features/{feature}/README.md` and `feature.yaml` when present; see **`FEATURES_INDEX.md`**
3. **External integration notes:** e.g. `.claude/features/auto-auth.external.md`

---

**Keep it lean. Load context only when needed.**
