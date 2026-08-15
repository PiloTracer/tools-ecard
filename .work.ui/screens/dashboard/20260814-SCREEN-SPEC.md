# Dashboard — Screen SPEC

**Status:** Approved  
**Needs:** nothing — owner-approved 2026-08-14 (decisions below); build gated on S0 primitives (foundation doc 03 waiver)  
**Slug:** dashboard  
**Path:** `.work.ui/screens/dashboard/20260814-SCREEN-SPEC.md`

---

## 1. Summary

The dashboard (`/dashboard`) is the authenticated home. After login (or demo-mode redirect) the operator lands to **do the primary jobs first**: **design a template**, **import a batch** (upload or paste, inline via `UploadBatchComponent`), and **view batches** — quick actions sit at the top with top priority. Below them, in collapsed expandable sections: **Subscription** (tier, status, usage) and **Settings** (project, work-phone prefix, phone-country prefix). **Your Account is removed from the dashboard** — account details live on `/profile`. Entry points: post-OAuth redirect (`/auth/continue` → `/dashboard`), Demo-mode `/demo` redirect, landing page. It is also the first screen a hostile first-click visitor sees in Demo mode — loading/empty/error states must degrade gracefully, never hang (foundation doc 01 principle 1).

## 2. Personas & jobs

| Persona | Job |
|---------|-----|
| Batch operator | Land, confirm subscription/usage state, select project, start a batch import or open batches |
| Template creator | Land, pick project, jump into the canvas designer |
| Demo visitor (unauthenticated) | Land in Demo mode, understand what the product does, try an import without breaking the UI |

## 3. States

| State | Behaviour |
|-------|-----------|
| loading | `ProtectedRoute` spinner gates auth; QuickActions shows overlay spinner ("Loading projects…") until `selectedProjectId` resolves; no full-page skeleton today — adopt shared `LoadingState`/`Skeleton` (doc 03) |
| empty | No projects: `ensureDefaultProject` auto-creates a default (no explicit empty state — keep; quick actions disabled until a project exists, with amber "select project" chip) |
| error | Projects error → `ProjectsIssueAlert`; subscription missing → yellow "subscription unavailable" card; both must render with retry/next-action copy (EN + ES) |
| success | Green auth-success banner shown **once after a fresh OAuth login** (sessionStorage flag set by the auth flow), dismissible; never rendered on subsequent loads (today it renders unconditionally — `page.tsx:281`) |
| partial | Subscription object missing fields → render known fields, degrade the rest (no partial card today — spec it) |

## 4. Layout & hierarchy

Single-column flow on a `surface-base` background, cards stacked with `surface-elevated` + `elevation-shadow-2` (tokens, not `shadow-md`). **Priority order top→bottom:** quick actions first (above the fold), then collapsed expandable sections.

| Region | Priority | Example id | Notes |
|--------|----------|------------|-------|
| App header (brand, title, welcome, lang switcher, profile, logout) | 0 | dashboards/D2 | active/selected-project affordance; mobile: wrap buttons, keep ≥44px targets |
| Quick actions (designer / import / batches) | 1 — **hero** | dashboards/D2 | 3-card grid at top of `<main>`, first in DOM/focus order; 1 col mobile → 3 cols md+ |
| Subscription (expandable, collapsed by default) | 2 | dashboards/D1 | `SectionHeader` toggle (`aria-expanded`); shows tier/status/reset + usage progress when open; summary line when closed (status badge + usage) |
| Settings — project, work-phone prefix, phone-country prefix (expandable, collapsed by default) | 3 | dashboards/D13 | `ProjectSelector` + `ProjectSettings`; role-gated actions: hide, don't disable |

**Expandable chosen over Modal** (owner latitude): accordion keeps the primary job un-interrupted and the page scannable; modals interrupt flow on a home screen. Breakpoints: `grid-cols-1 md:grid-cols-3` (quick actions), `md:grid-cols-2` (usage limits inside expanded subscription); `max-w-7xl` container; header flex wraps on mobile (UIS-01, UIS-02).

## 5. Content

i18n keys (EN + ES parity — `features/i18n/messages/{en,es}.ts`): `dashboard.title`, `welcomeBack`, `subscription`, `manageSubscription`, `currentPlan`, `status`, `billingResets`, `usageLimits`, `cardsGenerated`, `llmCredits`, `llmCreditsRemaining`, `subscriptionUnavailable`(+`Body`), `authSuccessTitle`(+`Body`), `quickActions.*` (title, templateDesigner(+Desc), viewBatches(+Desc), selectProject(+Title), viewBatchesTitle, loadingProjects), `common.profile`, `common.logout`. **New keys (settings section + expandable affordances):** `settings.title`, `settings.project`, `settings.workPhonePrefix`, `settings.phoneCountryPrefix`, `expand`/`collapse` labels. **Account keys (`yourAccount`, `email`, `username`, `displayName`, `userId`) move to the Profile screen** — removed from dashboard.

Copy rules: status labels capitalized + paired with icon; errors state what happened + next action; demo banner stays orange (`accent`) with the existing i18n copy.

## 6. Interactions

- Focus order: header (lang switcher → profile → logout) → **quick actions** (first in DOM) → subscription toggle → settings toggle.
- Quick action cards navigate (`router.push('/template-textile' | '/batches')`); **Import Batch** renders `UploadBatchComponent` inline (dropzone + paste — the hostile-paste surface; see `batch-import` SPEC link).
- Subscription + Settings sections are **accordions** (`<button aria-expanded aria-controls>` toggles, content region `aria-labelledby`); one open at a time or independent — independent toggles, both default **collapsed**.
- Actions disabled (not hidden) when no project selected, with visible "select project" hint — exception: role-gated actions use **hide, don't disable** (D13).
- Manage Subscription opens `USER_SUBSCRIPTION_URL` in a new tab (`rel=noopener noreferrer`).
- Keyboard: all cards are real `<button>`/`<Link>` (native focus); accordion toggles keyboard-accessible (Enter/Space, arrow keys optional).

## 7. Data dependencies

- `useAuth` user + subscription object (auth feature) — link `.work/features/from-claude/authentication/`
- `useProjects` (`simple-projects`) — `.work/features/from-claude/simple-projects/`
- `USER_SUBSCRIPTION_URL` (external Tools Dashboard) — `front-cards/shared/lib/oauth-config.ts`
- QuickActions/UploadBatch — `.work/features/from-claude/batch-upload/` + `batch-import/` (field-mapping SPEC: `.work/features/specs/`)

## 8. Tokens & components

Use `--surface-*`, `--elevation-shadow-*`, `--border-*`, `--accent-*`, `--status-*`, `--text-*` from foundation doc 02 / `tokens.json`.

| Component | Catalog status | Native waiver |
|-----------|----------------|---------------|
| AppShell | planned | waiver (S0) |
| Card | planned | waiver (S0) |
| Button | planned | waiver (S0) |
| Badge (status, icon + label) | planned | waiver (S0) |
| Progress (usage bars) | planned | waiver (S0) |
| SectionHeader | planned | waiver (S0) |
| Select (project selector) | planned | waiver (S0) — native `<select>` allowed until catalog Select exists |

**Waiver:** build gated on S0 primitives (foundation doc 03 migration backlog); `@ui-component-build plan` starts only after P0 primitives done. No native range/checkbox on primary flows.

## 9. Accessibility

WCAG AA (assumption — foundation UA1, to be measured). Focus ring = `accent` (2px + 2px offset) on all interactive elements; status badges carry icon + text label, never color-only (UIS-04); touch targets ≥ 44px (mobile); loading overlay has `aria-busy` + live region; contrast on amber/green banner text verified.

## 10. Analytics

Events (no PII): `dashboard_view` · `project_selected` · `quick_action_clicked{action: create_template|import_batch|view_batches}` · `manage_subscription_clicked` · `logout_clicked`.

## 11. Acceptance criteria

- [ ] All cards use `surface-elevated` + `elevation-shadow-2` tokens; no `shadow-md`/hardcoded hex (D2: soft card elevation on light background)
- [ ] **Quick actions are the hero region**: first in DOM/focus order, above the fold, 3-card grid (designer / import / batches), 1 col mobile → 3 cols md+ (D2 line-items-as-cards)
- [ ] Subscription is a collapsed-by-default expandable section with a summary line (status badge + usage) and full tier/status/reset/usage content when expanded (D1: one hero metric + metadata row; status legend not color-only)
- [ ] Settings is a collapsed-by-default expandable section: project selector + work-phone prefix + phone-country prefix; changes persist via `ProjectSettings` (D13)
- [ ] **Account card removed** — email/username/displayName/userId surface only on `/profile`
- [ ] Usage limits render as labeled progress with value readout; threshold coloring never sole signal (UIS-04)
- [ ] Subscription status badge = Badge primitive (icon + label + semantic color); tier badge neutral (D1/D2)
- [ ] Role-gated actions hidden by role, never disabled; project-less state uses the amber "select project" hint (D13: hide, don't disable)
- [ ] Accordion toggles: `aria-expanded` + `aria-controls`, keyboard accessible, EN+ES labels
- [ ] Loading: QuickActions overlay with `aria-busy`; no bare "Loading…" text without spinner (doc 01 principle 1)
- [ ] Error/empty: projects error alert + subscription-unavailable card both present with next-action copy; success banner only after fresh login, dismissible
- [ ] EN + ES copy parity for all keys in §5
- [ ] Header responsive: buttons wrap, ≥44px targets, no horizontal overflow on 360px viewport
- [ ] Data flow: `ensureDefaultProject` no infinite loop (existing `defaultEnsureDoneRef` guard preserved)

## 12. Concept / UIS registry

| UIS | Applies | Reason | Status |
|-----|---------|--------|--------|
| UIS-01 | yes | new layout/scan path | pending |
| UIS-02 | yes | mobile header + card grids (public Demo) | pending |
| UIS-03 | no | minimal motion — no decorative animation | N/A |
| UIS-04 | yes | status/usage not color-only | pending |
| UIS-05 | yes | settings section includes prefix form fields (work phone, phone country) | pending |
| UIS-06 | yes | agent build | pending |
| UIS-07 | yes | craft tier refined | pending |
| UIS-08 | yes | all screens before ship | pending |
| UIS-09 | no | not analytical dashboard | N/A |
| UIS-10 | no | no creative hero | N/A |

## 13. Visual references

| Field | Value |
|-------|-------|
| **exampleIds** | `dashboards/D1`, `dashboards/D2`, `dashboards/D13` |
| **manifestPaths** | `.ai.ui/examples/dashboards/manifest.md` |
| **craftTier** | refined |
| **beforeScreenshot** | `inputs/design-references/dashboard-before.png` (optional — capture when dev stack up) |

### extractedRules (binding, subset for this screen)

- **D1** — One hero metric + metadata row per card; segmented status bar with legend — **not color-only**; line items as cards.
- **D2** — Soft card elevation on light background (elevated surface + shadow tokens); active-state affordance for the selected project/nav.
- **D13** — Role-based visibility: **hide items, don't disable**; branding stays in header (product icon) and footer.

### regionMap

| §4 region | example id |
|-----------|------------|
| App header | dashboards/D2 |
| Quick actions | dashboards/D2 |
| Subscription | dashboards/D1 |
| Settings (project + prefixes) | dashboards/D13 |

### Figma / external (optional)

- (none)

## 14. Data visualization

**N/A** — this screen has progress bars only, no charts; chart rules (§14a–e) apply to batches/records screens if/when charted. Usage bars keep a textual value readout (a11y-safe).

---

## Decisions (owner, 2026-08-14)

1. **Accent color: brand-orange** — adopt `#c45c26` from foundation doc 02 (demo banner); supersedes the current `blue-600` (logo, buttons, links, progress). → resolves UU1; S0 token adoption may proceed.
2. **Success banner: once per fresh login** — shown only when the auth flow set a fresh-login flag (sessionStorage), dismissible; never on subsequent loads (current code renders it unconditionally — `page.tsx:281` — to be fixed).
3. **Slim IA:** quick actions first (hero) → Subscription (expandable, collapsed) → Settings: project + work-phone prefix + phone-country prefix (expandable, collapsed); **Account card removed** → lives on `/profile`. Expandable (accordion) chosen over Modal for both (owner latitude).

## Next action

`@ui-screen-spec review - .work.ui/screens/dashboard/20260814-SCREEN-SPEC.md`
