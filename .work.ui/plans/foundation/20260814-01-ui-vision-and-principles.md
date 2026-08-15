# tools-ecards (E-Cards) — UI vision and principles

**Doc:** UI foundation **01** · **Created:** 2026-08-14 · **Path:** `.work.ui/plans/foundation/` · **Status:** Approved (owner greenfield go 2026-08-14) · **Needs:** nothing

## Project classification

| Field | Value |
|-------|-------|
| **Archetype** | saas-product |
| **Complexity** | M |
| **Style stack** | tailwind (v4, CSS-first `@theme` — no `tailwind.config.ts`) |
| **Primary surfaces** | web responsive (mobile hardening in progress — public Demo) |

(Source: `@ui-project-approach` · recorded in `HANDOFF_UI`)

## Product UI intent

> E-Cards is a digital card design and batch generation platform. Users design visual card templates on a Fabric.js canvas, import recipient lists by file upload or paste, map unknown fields, and generate personalized cards at scale. The **public Demo** is an unauthenticated, browser-persisted mirror linked from LinkedIn and the company website — it must survive a hostile first click (very large paste, malformed CSV, unknown labels, mobile viewport) with a visible, guided outcome; a demo that breaks on the first click is worse than no demo. (Product scope: `.work/plans/foundation/20260427-01-tools-ecards-initial-scope.md`; Demo persistence ADR `20260716-007`.)

## Design principles

1. **Never break on bad input.** Any hostile input (large paste, malformed CSV, unknown labels, zero-width/mobile viewport) must degrade to a visible, guided state — mapping modal, error card with retry, or safe empty state — never a hang, a silent drop, or a blank "Loading…" dead-end. Every surface needs defined loading, empty, and error states.
2. **Data legibility first.** Batch operators read status at a glance: status badges, one primary metric per card, legends never color-only (UIS-04). Dense tables and card grids share a consistent surface stack and spacing rhythm.
3. **Progressive disclosure for the designer's power.** Canvas + toolbox + property panel chrome stays scannable; advanced controls (layers, QR, per-word color) reveal on demand. The designer shell is a first-class surface, not a bolt-on.
4. **Tokens before utilities.** Semantic tokens (surface, text, border, elevation, status) live in `front-cards/app/globals.css` `@theme` and are the only source of color/space/type — no ad-hoc hex in components (today: `DemoModeProvider.tsx` `#1a1a1a`/`#c45c26`, landing gradients — to be migrated).

## Density and tone

- Density: **comfortable**
- **Craft tier:** **refined** (customer-facing SaaS; catalog primitives for controls on primary flows — SURFACE-AND-CONTROL-CRAFT §1)
- Motion: **minimal** (UIS-03 — status/feedback only; no decorative animation)
- Brand voice in UI copy: calm, direct, professional; **EN + ES** microcopy via `front-cards/features/i18n/messages/{en,es}.ts`; errors explain what happened and what to do next.

## Out of scope (UI v1)

- Marketing-site surfaces (landing page stays minimal; the company website lives outside this repo)
- Storybook catalog (deferred to `@ui-design-system init`; catalog tracked in `.work.ui/design-system/CATALOG.md`)
- Full dark-mode theme work (today: only `prefers-color-scheme` auto switch on two tokens)
- White-label / tenant theming and i18n expansion beyond EN/ES
- Premium-tier effects (glass/blur) without a SPEC §13 example citation

## Links

- Domain scope: `.work/plans/foundation/20260427-01-tools-ecards-initial-scope.md` (Agent OS)
- Inputs: `.ai.ui/inputs/brand/` (reference only — none present)

## Next action

`@ui-design-foundation greenfield` — continue with foundation doc 02 (design tokens)
