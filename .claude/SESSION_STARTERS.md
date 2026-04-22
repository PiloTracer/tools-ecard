# Claude Code session starters

**Purpose:** Short copy-paste prompts. Load only what you need.

**Paths:** `CONTEXT.md` and `DOCS_CONTEXT.md` live in the **repository root** (no leading `/`).

---

## Quick start (copy and paste)

### 1. General work session

```
Working on E-Cards (tools-ecards).

Read: CONTEXT.md

What should I work on?
```

---

### 2. Feature-specific work

```
Working on {FEATURE_NAME} feature.

Read:
1. CONTEXT.md (pointers) or DOCS_CONTEXT.md (deep overview)
2. .claude/features/{FEATURE_NAME}/README.md (or legacy .claude/features/{FEATURE_NAME}.md if present)

Task: {DESCRIBE_TASK}
```

**`{FEATURE_NAME}` examples (see `FEATURES_INDEX.md`):** `auto-auth`, `template-textile`, `batch-import`, `s3-bucket`, `font-management`, `render-worker`, etc.

---

### 3. Bug fix session

```
Fixing bug in E-Cards.

Bug: {DESCRIPTION}
Path: {FILE_PATH}

Read: DOCS_CONTEXT.md (only if you need system context)
```

---

### 4. Database work

```
Working on database for E-Cards.

Read:
1. DOCS_CONTEXT.md — domain / data section as needed
2. .claude/features/database-setup.md
3. api-server/prisma/

Task: {MIGRATION | SCHEMA_CHANGE | QUERY}
```

---

### 5. External integration

```
Integrating with external system.

Read:
1. .claude/features/auto-auth.external.md
2. DOCS_CONTEXT.md — external integrations

System: {OAUTH / SUBSCRIPTION / STORAGE}
```

---

## Planning and architecture

### 6. Feature planning

```
Planning {FEATURE_NAME} implementation.

Read:
1. .claude/features/feature-order.md
2. .claude/features/{FEATURE_NAME}/README.md
3. DOCS_CONTEXT.md (architecture) if scope is large

Output: short plan; link to .claude/plans/ if you create one
```

### 7. Review implementation order

```
Review E-Cards development sequence.

Read: .claude/features/feature-order.md
```

---

## Advanced sessions

### 8. Security review

```
Security review for E-Cards.

Focus: {AUTH | API | DATA | FRONT}

Read: DOCS_CONTEXT.md — security; .claude/features/auto-auth.md
```

### 9. Performance

```
Optimizing E-Cards.

Read: DOCS_CONTEXT.md — performance; DOCS_TECH_STACK.md — services
```

### 10. Tests

```
Implementing tests for {FEATURE_NAME}.

Read: .claude/features/{FEATURE_NAME}/README.md

Test type: {UNIT | INTEGRATION | E2E}
```

---

## Minimal context (tips)

- **Start with `CONTEXT.md`** (links only), then open **`DOCS_TECH_STACK.md`** for Docker and commands.
- **Load** `.claude/features/.../README.md` **only** for the feature in scope.
- **Setup:** `README.md` + `DOCS_TECH_STACK.md` (not a separate `DOCKER.md` in this repo unless added later).
- Cite `path:line` for code, not long pasted blocks.

---

## File quick links (repo root = `.`)

| Topic | File |
|--------|------|
| Pointers | `CONTEXT.md` |
| Full architecture | `DOCS_CONTEXT.md` |
| Stack / Docker / ports | `DOCS_TECH_STACK.md` |
| Agent rules | `.cursorrules` |
| Resume handoff | `.ai/context/HANDOFF.md` |
| Feature list | `.claude/FEATURES_INDEX.md` |
| Setup | `README.md` |
| Env key names | `.env.dev.example` (do not commit secrets) |

---

**Last updated:** 2026-04-22
