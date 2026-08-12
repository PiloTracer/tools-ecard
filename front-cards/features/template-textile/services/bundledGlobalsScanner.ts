/**
 * Bundled-globals directory scanner (server-side only).
 *
 * Replaces the old checked-in manifest.json + regeneration script: the
 * front-cards Node server reads `public/templates/globals/` live, so dropping
 * `<name>.zip` (+ optional `<name>.png` preview + `<name>.json` sidecar) into
 * a directory is the whole publishing step — nothing to regenerate.
 *
 * Layout:
 *   globals/        → shared set (listed on every site)
 *   globals/demo/   → demo site only
 *   globals/prd/    → production site only
 *
 * Entry shape per ZIP found: { name, file, preview?, description? }
 *   - name: sidecar `name` if the optional `<name>.json` provides one,
 *     otherwise the filename stem
 *   - file: path relative to the globals root (e.g. "demo/A.zip")
 *   - preview: same-named .png when present
 *   - description: sidecar `description` when present
 *
 * Anything unreadable (bad sidecar JSON, missing dirs) degrades to fewer
 * entries — it never throws.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface BundledGlobalEntry {
  name: string;
  file: string;
  preview?: string;
  description?: string;
}

export interface BundledGlobalsListing {
  shared: BundledGlobalEntry[];
  demo: BundledGlobalEntry[];
  prd: BundledGlobalEntry[];
}

const SCOPES = ['demo', 'prd'] as const;

function defaultBaseDir(): string {
  return join(process.cwd(), 'public', 'templates', 'globals');
}

function readSidecar(dir: string, stem: string): { name?: string; description?: string } {
  try {
    const raw = readFileSync(join(dir, `${stem}.json`), 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    const out: { name?: string; description?: string } = {};
    if (typeof data.name === 'string' && data.name.trim()) out.name = data.name.trim();
    if (typeof data.description === 'string' && data.description.trim()) {
      out.description = data.description.trim();
    }
    return out;
  } catch {
    return {}; // missing or unreadable sidecar is fine
  }
}

function scanDir(dir: string, relPrefix: string): BundledGlobalEntry[] {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return []; // directory absent on this deployment
  }

  return files
    .filter((f) => f.toLowerCase().endsWith('.zip'))
    .sort()
    .map((file) => {
      const stem = file.replace(/\.zip$/i, '');
      const sidecar = readSidecar(dir, stem);
      const entry: BundledGlobalEntry = {
        name: sidecar.name ?? stem,
        file: `${relPrefix}${file}`,
      };
      const preview = files.find((f) => f.toLowerCase() === `${stem.toLowerCase()}.png`);
      if (preview) entry.preview = `${relPrefix}${preview}`;
      if (sidecar.description) entry.description = sidecar.description;
      return entry;
    });
}

export function scanBundledGlobals(baseDir?: string): BundledGlobalsListing {
  const base = baseDir ?? defaultBaseDir();
  const listing: BundledGlobalsListing = {
    shared: scanDir(base, ''),
    demo: [],
    prd: [],
  };
  for (const scope of SCOPES) {
    const dir = join(base, scope);
    if (existsSync(dir)) listing[scope] = scanDir(dir, `${scope}/`);
  }
  return listing;
}
