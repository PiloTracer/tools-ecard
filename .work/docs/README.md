# `.work/docs/` — project documentation

Project-specific documentation that does not fit into the standard `.work/` subdirectories (plans, features, decisions, prompts).

## Structure

| Path | Contents |
|------|----------|
| `guides/` | Task-oriented how-to guides (`YYYYMMDD-<slug>.md`) |
| `tutorials/` | Step-by-step walkthroughs (`YYYYMMDD-<slug>.md`) |
| `reference/` | Reference / API docs (`YYYYMMDD-<slug>.md`) |
| `features/<slug>/` | Per-feature user documentation — what it does, how to use it |
| `integration/` | Vendor/API cache (see `MANIFEST.txt`) |
| `standards/` | Project-specific engineering conventions and directory map |
| `from-claude-remote-server/` | Remote production deployment reference (Nginx + compose) migrated from `.claude/` |
| `from-claude-tutorials/` | Integration/setup tutorials migrated from `.claude/` |

## Feature docs vs SPECs

- **`.work/features/<slug>/SPEC.md`** — formal behavioural SPEC per FEATURE_STANDARD (for planning & implementation)
- **`.work/docs/features/<slug>/README.md`** — human-readable feature documentation (for users, operators, brownfield discovery)

**Create:** `@docs create guide - <slug>` · `@docs create tutorial - <slug>` · `@docs create reference - <slug>` · `@feature-spec document - <slug>` (brownfield feat. docs)
