# RISK_REGISTRY — UI planning registry

**Updated:** 2026-08-14

Status: **Open** | **Mitigated** | **Accepted** | **Closed**

| ID | Risk | Category | Likelihood | Impact | Mitigation | Status | Owner |
|----|------|----------|------------|--------|------------|--------|-------|
| UR1 | Semantic-token migration (hardcoded hex → tokens) touches many files; visual regression risk | design | M | M | S0 primitives first; `@ui-visual-verify` before/after; tokenize incrementally per surface | Open | eng |
| UR2 | Hostile first click (very large paste, malformed CSV, unknown labels) breaks the public Demo | robustness | M | H | Size/row limits + guided error/empty/loading states (doc 01 principle 1); parser fixes in both parsers; browser click-through incl. deliberate bad input | Open | eng/owner |
| UR3 | Fixed 3-column designer chrome unusable on mobile viewports (public Demo linked from LinkedIn/website) | design | H | H | Responsive pass for demo surfaces; mobile viewport hardening in current session; screen-specs capture breakpoints | Open | eng |
| UR4 | Dark mode is auto-only today (2 tokens) — inconsistent surfaces when `prefers-color-scheme: dark` | design | M | L | Out of UI v1 scope (doc 01); dark palette defined in tokens.json for future wiring | Accepted | owner |
