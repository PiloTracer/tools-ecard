# System observations — operator intake

**Source:** `tmp/observaciones del sistema.odt`  
**Captured:** 2026-07-17  
**Reporter:** owner/operator  
**Language:** Spanish (original bullets preserved in *Original* column)

---

## Summary

| # | Theme | Priority | Status | Notes |
|---|-------|----------|--------|-------|
| F1 | Batch export respects export settings | P1 | done | Pass explicit `height: calculatedHeight` in single + batch export modals |
| F2 | Home button / navigation to home | P2 | done | Home icon on batches + records pages; designer button labeled Inicio |
| F3 | Regenerate failed cards | P1 | done | `POST .../render-retry` + Retry on `RenderStatusBadge` (`?templateId=` on records page) |
| F4 | Subscription information | P3 | partial | Dashboard has subscription card + external URL |
| F5 | User profile | P2 | open | No dedicated profile page beyond dashboard user info |
| F6 | Initial capitalization (names) | P2 | open | Text transform for initials / proper names |
| F7 | Default card size 1076px | P2 | done | New templates default 1076×380 (Business E-Card preset) |
| F8 | Batch edit field deselects on first keystroke | P1 | done | `RecordEditModal` init guard + focus regression test |
| F9 | Image container shapes (circle, etc.) | P2 | open | Image frames appear square-only today |
| F10 | Property panel spinner arrows not visible | P2 | done | Wider stepper column + `withStepper` on font size; Position already had steppers |
| F11 | Multi-select bulk delete | P2 | done | Keyboard multi-delete verified in code; skip delete while Fabric text editing |
| F12 | Template units (px, cm, in) | P2 | open | Designer dimensions are pixel-only |

---

## Items (detail)

### F1 — Batch export should use settings

- **Original:** *Que el batch export utilice los settings*
- **Area:** `front-cards/features/template-textile/services/batchExportService.ts`, export settings UI
- **Acceptance sketch:** Batch PNG/PDF export honors resolution, background, and font preload settings chosen in export UI — same as single-card export.
- **Status:** open

### F2 — Home button

- **Original:** *Crear botton de inicio para home*
- **Area:** Template designer chrome / global nav
- **Acceptance sketch:** Visible control returns user to dashboard or home route without browser back.
- **Status:** open

### F3 — Regenerate failed cards

- **Original:** *Regenerar Tarjetas Fallidas*
- **Area:** Batch records UI + render-worker job retry
- **Acceptance sketch:** From batch detail, filter `failed` records and trigger re-render (single or bulk).
- **Related:** M5 added `storageUrl` on render-status — backend hook exists; UX missing.
- **Status:** open

### F4 — Subscription information

- **Original:** *Información de Suscripción*
- **Area:** `front-cards/app/dashboard/page.tsx`
- **Evidence:** Dashboard already links to `USER_SUBSCRIPTION_URL`.
- **Gap:** In-app plan/status detail may be insufficient vs operator expectation.
- **Status:** partial

### F5 — User profile

- **Original:** *Crear perfil de usuario*
- **Area:** New profile route or dashboard section
- **Acceptance sketch:** View/edit display name, email, avatar, org — scope TBD with auth provider.
- **Status:** open

### F6 — Initial capitalization

- **Original:** *Reconocer iniciales para q el sistema la deje en mayuscula*
- **Area:** Text elements / field mapping / export
- **Acceptance sketch:** Name fields (or configured fields) auto-capitalize initials (e.g. “sofía rodríguez” → “Sofía Rodríguez”) with override in editor.
- **Status:** open

### F7 — Card size 1076px

- **Original:** *Tamano de las tarjetas 1076px*
- **Area:** Template defaults, new-template wizard
- **Acceptance sketch:** Product default canvas width/height = 1076px (confirm height aspect ratio with owner).
- **Status:** open — **needs owner confirm** (height? DPI?)

### F8 — Batch correction deselects field

- **Original:** *Cada ves que se hace correcion del batch hay q seleccionar manualmente el campo, pq se deselecciona despues del escribir el primer caracter*
- **Area:** Batch record inline edit components
- **Acceptance sketch:** Focus and active cell remain while typing; no re-click after first character.
- **Status:** open — **P1 UX bug**

### F9 — Image container shape (circle, etc.)

- **Original:** *Los contenedores de la imagen puedan cambiar de forma (ejemplo a circulo) pq ahorita solo esta cuadrado*
- **Area:** Image element / clip mask in Fabric canvas
- **Acceptance sketch:** Property panel offers shape mask: rectangle, circle, ellipse (clipPath).
- **Status:** open

### F10 — Property panel stepper arrows

- **Original:** *En el menu de propiedades de la derecha, las cajitas para modificar datos del lado izquierdo no se visualiza las flechas de subir y bajar los valores*
- **Area:** `PropertyPanel` numeric inputs (likely CSS / `input[type=number]` styling)
- **Status:** open

### F11 — Multi-select delete

- **Original:** *Cuando se seleccionan varios elementos se puedan borrar y no solo uno a uno*
- **Area:** `DesignCanvas.tsx` keyboard delete handler
- **Evidence:** Code path for multi-select delete exists (`isFabricActiveSelection`, Delete/Backspace) — **unverified in browser**.
- **Status:** partial — verify; may be regression or platform-specific

### F12 — Template measurement units

- **Original:** *Para los templetes tener medidas a escoger (ej: pixels, centimetros, pulgadas)*
- **Area:** Template metadata, PropertyPanel dimensions, export DPI
- **Acceptance sketch:** Store canonical px internally; display/edit in px, cm, or in with conversion.
- **Status:** open

---

## Suggested promotion to `NEXT.md`

| Priority | IDs | Rationale |
|----------|-----|-----------|
| **0** | F8 | Daily friction — likely small fix, high impact |
| **1** | F1, F3 | Batch workflow completeness |
| **2** | F7, F9, F10, F11 | Designer polish |
| **3** | F2, F5, F6, F12 | New surfaces / larger scope |
| **4** | F4 | Partially covered — clarify gap with owner |

---

## Related runtime errors (context only)

From `tmp/errors.txt` (2026-04-30): `Font not found` / Cassandra `Invalid null value in condition for column user_id` when loading global fonts — separate from above list; track under font-management if it recurs.
