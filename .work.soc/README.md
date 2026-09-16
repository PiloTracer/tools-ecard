# `.work.soc/` — Security Operations project memory

**Status:** Active · **Needs:** nothing — reference document

**Purpose:** All **project-specific** SOC artifacts: license analysis, threat models, compliance reviews, risk assessments, security posture plans, and session handoff.

**Agnostic** process (skills, scripts, templates) lives under **`.ai.soc/`** only.

## Layout

| Path | Contents |
|------|----------|
| `.work.soc/plans/` | SOC plans, `NEXT_SOC.md`, unknowns registry |
| `.work.soc/analysis/` | License audits, vulnerability reports, threat models, compliance reviews |
| `.work.soc/assessments/` | Per-target security assessments and penetration test reports |
| `.work.soc/prompts/` | Decision questionnaires for SOC scoping |
| `.work.soc/decisions/` | Security ADRs (`YYYYMMDD-NNN-*.md`) |
| `.work.soc/context/` | `HANDOFF_SOC.md` — SOC session boundary |

## Placeholder map

Defined by `.cursorrules` § SOC placeholders (thin-client — resolved from `$SOC_SOURCE`):

| Placeholder | Resolves to |
|-------------|-------------|
| `{WORK_SOC_ROOT}` | `.work.soc/` |
| `{WORK_ROOT}` | `dirname $SOC_SOURCE` — framework-siblings root (**not** `.work/`) |
| `{HANDOFF_SOC}` | `.work.soc/context/HANDOFF_SOC.md` |
| `{NEXT_SOC}` | `.work.soc/plans/NEXT_SOC.md` (the SOC iteration carrier) |
| `{UNKNOWNS_SOC}` | `.work.soc/plans/UNKNOWNS_SOC.md` |
| `{SKILLS_SOC_ROOT}` | `$SOC_SOURCE/skills/` |

## Quick pick-up

1. `.work.soc/context/HANDOFF_SOC.md`
2. `.work.soc/plans/NEXT_SOC.md`

Operator entry: `.ai.soc/START_HERE.md`

## Bootstrap

If this tree was created empty, run from repo root:

```bash
bash "$SOC_SOURCE/templates/bootstrap.sh"   # thin-client: SOC_SOURCE=/mnt/work/Projects/pilo.ai.soc.logicbison
```

Or invoke `@soc-deploy-basic update`.

## Next action

Next action: none — reference document
