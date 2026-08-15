# tools-ecards (E-Cards) — Design tokens

**Doc:** UI foundation **02** · **Created:** 2026-08-14 · **Status:** Draft (accent approved) · **Needs:** nothing — palette approved by owner 2026-08-14 (accent = brand-orange `#c45c26`)

## Canonical token file (code)

**Path:** `front-cards/app/globals.css` (application source — not under `.work.ui/`)

**Source of truth:** `.work.ui/design-system/tokens.json` (DTCG 2025.10, 104 tokens, validated by `token-schema-verify.sh`). Platform files (CSS `@theme` vars in `globals.css`, TS theme) are **generated** from it — sync, do not fork (`style-stacks/tailwind.md`). Tailwind v4 is CSS-first: tokens land in `@theme` inside `globals.css`; there is no `tailwind.config.ts`.

## Semantic token map (summary)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-text-primary` | oklch(0.26 …) `#171717` | `#f5f5f5` | body text (today's `--foreground`) |
| `--color-text-secondary` | `#525252` | `#a3a3a3` | secondary copy, descriptions |
| `--color-text-muted` | `#737373` | `#737373` | metadata, hints |
| `--color-text-on-accent` | `#ffffff` | `#ffffff` | text on accent buttons/badges |
| `--surface-base` | `#ffffff` | `#171717` | page background (today's `--background`) |
| `--surface-elevated` | `#fafafa` | `#1f1f1f` | cards, panels, toolbars |
| `--surface-inset` | `#f5f5f5` | `#262626` | wells, input backgrounds |
| `--surface-overlay` | `#ffffff` | `#1f1f1f` | sheets, modals, popovers |
| `--border-subtle` | `#e5e5e5` | `#262626` | region separators |
| `--border-default` | `#d4d4d4` | `#3f3f3f` | input/control borders |
| `--border-strong` | `#a3a3a3` | `#525252` | emphasis borders, dividers |
| `--accent-default` | `#c45c26` (brand orange) | `#d97a45` | primary actions, active states, focus ring |
| `--accent-hover` / `--accent-active` | `#a84e1f` / `#8f421a` | `#c45c26` / `#a84e1f` | accent interaction states |
| `--accent-subtle` | `#fdf0e8` | `#2a1a10` | accent-tinted backgrounds, badges |
| status success/warning/error/info (+ `-subtle` each) | greens/ambers/reds/blues | lightened dark variants | status badges, alerts, progress |

## Surface & control tokens

Required because craft tier = **refined** — [`20260523-SURFACE-AND-CONTROL-CRAFT.md`](../../standards/20260523-SURFACE-AND-CONTROL-CRAFT.md) §2.

| Layer | Token role | In this app |
|-------|------------|-------------|
| **base** | `--surface-base` | page background (white; dark auto) |
| **elevated** | `--surface-elevated` + `--elevation-shadow-1/2` | cards, toolbar wells, batch/record cards |
| **inset** | `--surface-inset` | input backgrounds, dropzone, KV-paste preview wells |
| **overlay** | `--surface-overlay` + scrim | modals (Save/Open template, FieldMapping, RecordEdit), dropdowns |

**Elevation:** `--elevation-shadow-1/2/3` only (0 1px 2px / 0 4px 6px / 0 10px 15px, black at 5/8/12% alpha) — never ad-hoc `box-shadow` in screen components (today: `shadow-sm` utilities — migrate to elevation tokens).
**Separators:** `--border-subtle` between regions; prefer spacing + separator over nested boxes.
**Focus:** `--accent-default` focus ring (2px ring + 2px offset) on all interactive controls (UIS-01).

## Rules

- Components use **semantic tokens only** — no ad-hoc hex in JSX class strings (today: `DemoModeProvider.tsx:92-95` `#1a1a1a`/`#c45c26`, `LandingPage.tsx:31-33` gradients — migration items, tracked in doc 03).
- Theme changes require **UIS-04** audit.
- States derived via `color-mix()` — never HSL-derived scales (skill §1 research rule).
- Font fix (evidence finding): `layout.tsx` declares Geist/Geist Mono vars but `body { font-family: Arial }` (`globals.css:25`) wins — wire `--font-geist-*`/`--font-sans` so Geist is actually applied; mono for IDs/timestamps only.

## Evidence

| Claim | Tag |
|-------|-----|
| WCAG target AA (normal text 4.5:1) — **assumption until measured** (no a11y tooling configured) | assumption |
| Brand accent = existing demo banner orange `#c45c26` | measured (code) |
| App ships light-first with `prefers-color-scheme` dark auto (2 tokens only today) | measured (code) |
| No spacing/radius/typography tokens exist today — everything is inline Tailwind utilities | measured (code) |

## Next action

`@ui-design-foundation greenfield` — continue with foundation doc 03 (pattern inventory)
