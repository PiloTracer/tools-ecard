# Front-end stack — tools-ecards (E-Cards)

> **Bootstrap:** Created by `@ui-bootstrap init` when missing. Customize pins; link from `.cursorrules` as `DOCS_UI_STACK.md`.

**Updated:** 2025-06-11

## Runtime

| Item | Value |
|------|-------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| Package manager | npm |

## Tooling

| Check | Command |
|-------|---------|
| Unit tests | `cd front-cards && npx jest` |
| Lint | `cd front-cards && npx eslint .` |
| Typecheck | `cd front-cards && npx tsc --noEmit` |
| Visual regression | *not configured* |
| Accessibility | *not configured* |

## Paths

| Item | Path |
|------|------|
| App root | `front-cards/` |
| Components | `front-cards/app/` |
| Screens | `front-cards/app/` (App Router routes) |
| Tokens | `front-cards/app/globals.css` |
| Framework config | `front-cards/next.config.ts` |

## Docker

| Service | Workdir |
|---------|---------|
| `front-cards` | `/app` |

## Design references

- Inputs: `.ai.ui/inputs/`
- Screen SPECs: `.work.ui/screens/`
