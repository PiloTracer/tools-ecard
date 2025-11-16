# Claude Code Session Starters

**Purpose:** Minimal prompts to start productive sessions quickly.

**Principle:** Load only what you need. Don't read everything at once.

---

## Quick Start (Copy & Paste)

### 1. General Work Session

```
Working on E-Cards System.

Read: /CONTEXT.md

What should I work on?
```

---

### 2. Feature-Specific Work

```
Working on {FEATURE_NAME} feature.

Read:
1. /CONTEXT.md (brief overview)
2. .claude/features/{FEATURE_NAME}.md (detailed spec)

Task: {DESCRIBE_TASK}
```

**Replace `{FEATURE_NAME}` with:**
- `auto-auth` - OAuth 2.0 authentication
- `database-setup` - Prisma schema & migrations
- `template-designer` - Visual canvas editor
- `batch-import` - Excel/text parsing
- `render-worker` - Card rendering engine
- `batch-management` - View/download batches
- `name-parser` - LLM name parsing
- `user-profile` - User settings

---

### 3. Bug Fix Session

```
Fixing bug in E-Cards.

Bug: {DESCRIPTION}
Location: {FILE_PATH}

Read: /CONTEXT.md (if needed)
```

---

### 4. Database Work

```
Working on database for E-Cards.

Read:
1. /CONTEXT.md → Domain Models section
2. .claude/features/database-setup.md

Task: {MIGRATION | SCHEMA_CHANGE | QUERY}
```

---

### 5. External Integration

```
Integrating with external system.

Read:
1. .claude/features/auto-auth.external.md (for epicdev.com specs)
2. /CONTEXT.md → External Integrations

System: {epicdev.com/app | epicdev.com/admin}
```

---

## Planning & Architecture

### 6. Feature Planning

```
Planning {FEATURE_NAME} implementation.

Read:
1. .claude/features/feature-order.md (dependencies)
2. .claude/features/{FEATURE_NAME}.md (if exists)
3. /CONTEXT.md (architecture overview)

Create implementation plan.
```

---

### 7. Review Implementation Order

```
Review E-Cards development sequence.

Read: .claude/features/feature-order.md

Adjust timeline based on: {CONSTRAINTS | TEAM_SIZE | PRIORITIES}
```

---

## Advanced Sessions

### 8. Security Review

```
Security review for E-Cards.

Focus: {AUTH | API | DATABASE | XSS | CSRF | INJECTION}

Read:
1. .claude/features/auto-auth.md → Security Model section
2. /CONTEXT.md → Security Considerations
```

---

### 9. Performance Optimization

```
Optimizing E-Cards performance.

Target: {API_LATENCY | RENDER_SPEED | DATABASE_QUERIES}

Read: /CONTEXT.md → Performance Targets

Current metrics: {PROVIDE_DATA}
```

---

### 10. Testing Strategy

```
Implementing tests for {FEATURE_NAME}.

Read: .claude/features/{FEATURE_NAME}.md → Testing Strategy

Test type: {UNIT | INTEGRATION | E2E}
```

---

## Tips for Minimal Context

### ✅ DO

- **Start with /CONTEXT.md** - Always provides high-level overview
- **Load feature specs on-demand** - Only read `.claude/features/*.md` when working on that feature
- **Use specific prompts** - Copy templates above instead of long descriptions
- **Reference line numbers** - When discussing code, cite file:line

### ❌ DON'T

- **Don't load all feature docs at once** - Wastes tokens
- **Don't repeat context** - If already in CONTEXT.md, just reference it
- **Don't include setup instructions** - Use `/README.md` or `/DOCKER.md`
- **Don't paste long code blocks** - Reference files instead

---

## Example Sessions

### Example 1: Start Work on Auto-Auth

**Bad (too much context):**
```
I'm working on authentication. Let me explain OAuth 2.0 and PKCE.
OAuth is... [500 words]
PKCE is... [300 words]
We need to implement... [200 lines of requirements]
```

**Good (minimal context):**
```
Working on auto-auth feature.

Read:
1. /CONTEXT.md (overview)
2. .claude/features/auto-auth.md (full spec)

Task: Implement frontend PKCE flow (useOAuthFlow hook)
```

---

### Example 2: Fix Render Worker Bug

**Bad:**
```
The render worker isn't working. Let me explain the entire architecture...
[Loads all of CONTEXT.md, render-worker.md, domain models, etc.]
```

**Good:**
```
Bug in render worker: Cards not rendering with correct colors.

File: render-worker/src/renderer.ts:142
Error: RGB values incorrect for multi-color text

Read: .claude/features/render-worker.md (if needed for context)
```

---

### Example 3: Plan Next Feature

**Bad:**
```
Let's plan everything. [Loads all 8 feature specs]
```

**Good:**
```
Planning batch-import feature implementation.

Read:
1. .claude/features/feature-order.md (check dependencies)
2. .claude/features/batch-import.md (detailed spec)

Current status: Auth done, database done, templates done.
```

---

## File Reference Quick Links

| Topic | File |
|-------|------|
| Project Overview | `/CONTEXT.md` |
| Setup Instructions | `/README.md`, `/DOCKER.md` |
| Implementation Order | `.claude/features/feature-order.md` |
| Auto-Auth Spec | `.claude/features/auto-auth.md` |
| External API Requirements | `.claude/features/auto-auth.external.md` |
| Database Models | `/CONTEXT.md` → Domain Models |
| Environment Config | `.env.dev.example` |

---

## Remember

**The goal is efficiency:**
- Shorter prompts = faster responses
- Targeted context = better answers
- On-demand loading = more tokens for implementation

**Think: "What's the minimum I need to load for this task?"**

---

Last Updated: 2025-11-15