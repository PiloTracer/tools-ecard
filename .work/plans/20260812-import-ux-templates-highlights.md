# What's New — Import & Templates (2026-08-12)

Plain-language highlights of the import-UX and template work. Everything below works in both **Demo** (browser-only) and **Normal** (login + server) mode unless noted.

## 1. Downloadable import templates — never guess the column names again

Two ready-made Excel files are one click away in the upload window:

- **Download template (rows)** — classic layout: column names across row 1, one example contact filled in, add your people from row 3 down.
- **Download template (columns)** — sideways layout: column names down the first column, one contact per column. Handy when your data arrives "rotated".

Both list the exact 30 field names the system understands (a note in cell A1 reminds you that English and Spanish names both work).

**Try it:** open Upload Batch → click either link → fill in two contacts → upload the file. It imports cleanly, no mapping screen needed.

## 2. Sideways (transposed) spreadsheets just work

Got an export where the field names run down column A and each person is a column? Previously that imported as garbage. Now the system detects the orientation automatically — in Demo and Normal alike — and imports it exactly like the normal layout. Ambiguous files still default to the old behavior, so nothing that worked before changes.

**Try it:** fill in the "columns" template from §1 (or transpose any contact sheet in Excel: copy → paste special → transpose) and upload it. The records come out identical to the row-layout twin.

## 3. vCard (.vcf) import — drop your phone contacts straight in

`.vcf` files (the format phones and Outlook export) are now a first-class import. Every contact in the file becomes its own record; versions 2.1, 3.0 and 4.0 are understood, including accented names in old quoted-printable encoding, phone-type routing (cell → mobile, work → office phone, "ext. 123" → extension), addresses, and notes. Anything the system doesn't recognize is kept in the record's extra data instead of being silently lost.

**Try it:** export a contact (or several) from your phone as `.vcf`, upload it, and check the batch: one record per person, names and phones in the right fields.

## 4. Field-mapping screen — teach it once, it remembers

Upload (or paste!) a spreadsheet whose columns don't match anything, and instead of dropping those columns, a **mapping screen** appears: each of your columns on one side, a dropdown of known fields on the other (labeled in English and Spanish, with real sample values from your file to guide you). Pair them once — or mark a column "Ignore" — and confirm. Two extras make it stick:

- **"Save this mapping as preset"** — name the mapping; the next file with the same columns (any order, any casing) is pre-matched automatically.
- **"Adjust mapping"** — a button in the name dialog lets you review the automatic guesses even when everything matched.

In Normal mode presets live in your account (they also re-apply if you retry a failed batch); in Demo they're stored in your browser. And unmappable columns are never thrown away anymore — they ride along in the record's extra data.

**Try it:** make a sheet with columns like `Código Empleado` and `Correo Personal` → upload → the mapping screen opens → pair them to the right fields, tick "Save this mapping as preset", name it → upload the same sheet again with columns shuffled → the preset is pre-applied.

## 5. Templates vs. designs — reusable starters that can't be ruined

Templates and your own designs are now separate things. The gallery has **All | Templates | My designs** filters with colored badges. Saving with **"Save as new template"** creates a reusable starter. Opening a template and hitting Save never overwrites it — it quietly creates your own copy (named "<template> copy"), so the original starter stays pristine for next time.

**Try it:** design a card → Save → tick "Save as new template" → open it from the Templates filter → change a color → Save → you now have a new design; the template is untouched.

## 6. Global templates — curated starters for everyone (admins only)

Users with the `appsuper` or `appglobal` role (assigned in tools-dashboard) can save a template as **Global (all users)**. It shows up in everyone's gallery with a green "Global" badge. Regular users can open it and Save — which gives them their own editable copy — but can never modify or delete the original. Only global managers see the delete button, and every create/edit/delete is double-checked against the auth server (if that check can't be performed, the action is refused rather than allowed). Without the role, the whole feature is invisible.

**Try it (needs a role-holding account):** Save → "Save as new template" → tick "Global (all users)" → log in as a regular user → the template appears with its badge → open, Save → you get a personal copy.

## 7. Bundled global templates — ship starters without touching the server

Operators can drop a template package (the `.zip` the Export button produces) plus a same-named `.png` preview into `front-cards/public/templates/globals/`, run one manifest-regeneration command, and it appears in everyone's gallery — including Demo mode, with zero server or database involvement. Broken files are skipped silently (console note), never breaking the gallery.

**Try it (operator):** Export a design → copy the zip + a preview png into `front-cards/public/templates/globals/` → run `docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && node scripts/build-global-templates-manifest.mjs"` → open the gallery; it's there, badged Global.

---

**Full technical inventory & verification steps:** `.work/plans/20260812-import-ux-templates-list.md` · **Plan & implementation record:** `.work/plans/20260812-import-ux-templates-plan.md` §9.
