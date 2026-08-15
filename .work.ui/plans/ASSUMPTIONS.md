# ASSUMPTIONS — UI planning registry

> Created by bootstrap; maintained by **`ui-*` skills**.

**Updated:** 2026-08-14

Label every entry: **Confirmed** | **Inference** | **Unverified** | **Rejected**

| ID | Assumption | Label | Source | Notes |
|----|------------|-------|--------|-------|
| UA1 | WCAG AA (4.5:1 normal text) is the accessibility target | Unverified | foundation doc 02 | No a11y tooling configured yet; must be measured before screen-spec certification |
| UA2 | Geist is the intended app font (declared via `next/font/google`) | Confirmed | `front-cards/app/layout.tsx:2,7-15` | `body { font-family: Arial }` (`globals.css:25`) currently overrides it — fix in S0 |
| UA3 | Demo is a mode (localStorage flag + banner), not a route tree | Confirmed | ADR `20260716-007`, `DemoModeProvider.tsx` | Screen map treats it as an overlay on all routes |
| UA4 | Proposed oklch palette (converted from existing hex) preserves current brand look | Inference | foundation doc 02 | Needs `@ui-visual-verify` before token adoption |

## Rejected

| ID | Assumption | Reason |
|----|------------|--------|
| - | (none) | |
