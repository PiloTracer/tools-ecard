#!/usr/bin/env node
/**
 * Build the bundled global-templates manifest (Pass 5, plan A4.2).
 *
 * Scans public/templates/globals/ for *.zip files (design packages produced
 * by the editor's existing Export feature), pairs an optional same-named
 * preview image (<name>.png), and writes manifest.json entries:
 *   [{ "name", "file", "preview"?, "description"? }]
 *
 * Existing descriptions in manifest.json are preserved by entry name.
 *
 * MANUAL STEP — intentionally NOT wired into package.json (protected file).
 * Run inside the front-cards container after dropping files:
 *   docker compose -f docker-compose.dev.yml exec front-cards \
 *     sh -c "cd /app && node scripts/build-global-templates-manifest.mjs"
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const globalsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'templates', 'globals');
const manifestPath = join(globalsDir, 'manifest.json');

if (!existsSync(globalsDir)) {
  console.error(`[build-global-templates-manifest] Directory not found: ${globalsDir}`);
  process.exit(1);
}

// Preserve descriptions from the existing manifest (keyed by entry name).
const descriptions = new Map();
if (existsSync(manifestPath)) {
  try {
    const existing = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    if (Array.isArray(existing)) {
      for (const entry of existing) {
        if (entry && typeof entry.name === 'string' && typeof entry.description === 'string') {
          descriptions.set(entry.name, entry.description);
        }
      }
    }
  } catch (error) {
    console.warn('[build-global-templates-manifest] Existing manifest unreadable — descriptions not preserved:', error.message);
  }
}

const files = readdirSync(globalsDir);
const zipFiles = files.filter((f) => f.toLowerCase().endsWith('.zip')).sort();

const manifest = zipFiles.map((file) => {
  const name = file.replace(/\.zip$/i, '');
  const entry = { name, file };
  const preview = files.find((f) => f.toLowerCase() === `${name.toLowerCase()}.png`);
  if (preview) entry.preview = preview;
  if (descriptions.has(name)) entry.description = descriptions.get(name);
  return entry;
});

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`[build-global-templates-manifest] Wrote ${manifest.length} entr${manifest.length === 1 ? 'y' : 'ies'} to ${manifestPath}`);
for (const entry of manifest) {
  console.log(`  - ${entry.name} (${entry.file}${entry.preview ? `, preview: ${entry.preview}` : ''})`);
}
