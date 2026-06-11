# NEXT - planning backlog

**Updated:** 2026-04-27

---

## Done

| Item | Artifact |
|------|----------|
| Agent OS bootstrap | `.work/` skeleton, `.cursorrules` from template |
| .claude → .work migration | All content migrated: features, plans, fixes, implementations, prompts, specs, tutorials, analysis, remote_server_reference |
| .cursorrules configured | All REPLACE tokens resolved to project paths |
| .work/docs/ populated | Project-specific standards, directory map, remote server reference, tutorials |
| .claude archived | Renamed to `.claude.deprecated/` with `.gitignore` entry |
| @plan-repair brownfield (foundation) | Doc 01 (scope) + doc 04 (architecture) synthesized; 6 ADRs written |
| @plan-repair brownfield (master) | Draft master plan with M1-M3 milestones; registries populated |
| @plan-master integrity | Phase 5 pass with waivers; plan-master-ready: yes |
| @plan-master continue → Approved | Master plan set to Approved; sections 20–25 + appendices added |

---

## Blocked on owner

| # | Item | Notes |
|---|------|-------|
| - | (none) | |

---

## Recommended next

| Priority | Item | Notes |
|----------|------|-------|
| **0** | `@code-implementation plan - M1` | Start M1: replace mock rendering with real Canvas/Sharp logic |

---

## Current iteration

*(No active iteration - run `@code-implementation plan - M1` after master plan is **Approved** and `implementation-ready: yes`.)*

```markdown
## Current iteration - M{N}: <milestone name>

**Milestone ref:** M{N} · `{MASTER_PLAN}` §<task section>
**Status:** planning | in-progress | complete
**Started:** YYYY-MM-DD

### In scope
- …

### Out of scope (explicit)
- …

### Tasks
| ID | Description | Files | Status | Notes |
|----|-------------|-------|--------|-------|
| M{N}-T1 | … | … | pending | |

### Acceptance criteria
- [ ] …

### Validation steps
- [ ] Tests: `REPLACE:TEST_COMMAND` (per `.cursorrules`)
- [ ] Lint: `REPLACE:LINT_COMMAND`
- [ ] Type: `REPLACE:TYPECHECK_COMMAND`

### Owner blockers
- none

### Concept / NFR registry (this iteration)
| Concept id | Applies | Status | Evidence / trigger |
|------------|---------|--------|-------------------|
| MOD-06 | yes | pending | AI-assisted session |

### Cross-LLM verification
- Triggered: no

### Done this iteration
| Task | Completed | Notes |
|------|-----------|-------|
```
