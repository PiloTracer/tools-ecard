# .claude Directory

This directory contains Claude Code project-specific context and documentation.

## Structure

```
.claude/
├── README.md              # This file - directory overview
├── SESSION_STARTERS.md    # Quick-start prompts for new sessions
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
- **NOT in .claude/**: General architecture (see /CONTEXT.md), setup guides (see /README.md)

### What Doesn't Go Here

- ❌ General project setup (belongs in `/README.md`)
- ❌ Broad architecture overview (belongs in `/CONTEXT.md`)
- ❌ Docker/infrastructure details (belongs in `/DOCKER.md`)
- ❌ Implementation code (belongs in service directories)

## Usage

### Starting a New Session

1. **General Work**: Copy template from SESSION_STARTERS.md → "General Project Session"
2. **Feature Work**: Copy feature-specific template from SESSION_STARTERS.md
3. **Feature Deep Dive**: Reference specific `.claude/features/*.md` file

### Reading Order

1. **Always read first**: `/CONTEXT.md` (concise overview)
2. **For feature work**: `.claude/features/{feature-name}.md`
3. **External integrations**: `.claude/features/*.external.md`

---

**Keep it lean. Load context only when needed.**
