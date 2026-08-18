/**
 * Bundled-globals directory scanner (server-side only).
 *
 * Replaces the old checked-in manifest.json + regeneration script: the
 * front-cards Node server reads `public/templates/globals/` live, so dropping
 * `<name>.zip` (+ optional `<name>.png` preview + `<name>.json` sidecar) into
 * a directory is the whole publishing step — nothing to regenerate.
 *
 * A single `<name>.zip` may also embed its own `<name>.png` + `<name>.json`
 * sidecars; the legacy `preview.png` / `sidecar.json` names are still accepted
 * for backward compatibility.
 *
 * Layout:
 *   globals/        → shared set (listed on every site)
 *   globals/demo/   → demo site only
 *   globals/prd/    → production site only
 *
 * Entry shape per ZIP found: { name, file, preview?, previewInZip?, previewInZipFile?, description? }
 *   - name: sidecar `name` if the optional `<name>.json` (or embedded sidecar)
 *     provides one, otherwise the filename stem
 *   - file: path relative to the globals root (e.g. "demo/A.zip")
 *   - preview: same-named .png when present as a separate file
 *   - previewInZip: true when a preview is embedded inside the ZIP
 *   - previewInZipFile: filename of the embedded preview (e.g. "A.png")
 *   - description: sidecar `description` when present
 *
 * Anything unreadable (bad sidecar JSON, missing dirs, corrupt ZIP) degrades
 * to fewer entries — it never throws.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';

export interface BundledGlobalEntry {
  name: string;
  file: string;
  preview?: string;
  /** True when a preview image is embedded inside the ZIP. */
  previewInZip?: boolean;
  /** Filename of the embedded preview (e.g. "A.png"), if known. */
  previewInZipFile?: string;
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
    return parseSidecar(raw);
  } catch {
    return {}; // missing or unreadable sidecar is fine
  }
}

function parseSidecar(raw: string): { name?: string; description?: string } {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    const out: { name?: string; description?: string } = {};
    if (typeof data.name === 'string' && data.name.trim()) out.name = data.name.trim();
    if (typeof data.description === 'string' && data.description.trim()) {
      out.description = data.description.trim();
    }
    return out;
  } catch {
    return {};
  }
}

async function peekZipSidecars(
  zipPath: string,
  stem: string
): Promise<{ name?: string; description?: string; hasPreview: boolean; previewFileName?: string } | null> {
  try {
    const buffer = readFileSync(zipPath);
    const zip = await JSZip.loadAsync(buffer);
    // Prefer sidecars named after the ZIP stem; fall back to legacy names.
    const sidecarFile = zip.file(`${stem}.json`) ?? zip.file('sidecar.json');
    const previewFile = zip.file(`${stem}.png`) ?? zip.file('preview.png');
    const sidecar = sidecarFile ? parseSidecar(await sidecarFile.async('string')) : {};
    return {
      ...sidecar,
      hasPreview: previewFile !== null,
      previewFileName: previewFile ? previewFile.name : undefined,
    };
  } catch {
    return null;
  }
}

async function scanDir(dir: string, relPrefix: string): Promise<BundledGlobalEntry[]> {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return []; // directory absent on this deployment
  }

  const entries: BundledGlobalEntry[] = [];
  const zipFiles = files.filter((f) => f.toLowerCase().endsWith('.zip')).sort();

  for (const file of zipFiles) {
    const stem = file.replace(/\.zip$/i, '');
    const sidecar = readSidecar(dir, stem);
    const entry: BundledGlobalEntry = {
      name: sidecar.name ?? stem,
      file: `${relPrefix}${file}`,
    };

    const externalPreview = files.find((f) => f.toLowerCase() === `${stem.toLowerCase()}.png`);
    if (externalPreview) {
      entry.preview = `${relPrefix}${externalPreview}`;
    }

    if (sidecar.description) entry.description = sidecar.description;

    // If external sidecar/preview are missing, peek inside the ZIP for embedded ones.
    if (!entry.preview || !entry.name || !entry.description) {
      const embedded = await peekZipSidecars(join(dir, file), stem);
      if (embedded) {
        if (!entry.preview && embedded.hasPreview) {
          entry.previewInZip = true;
          entry.previewInZipFile = embedded.previewFileName;
        }
        if (!sidecar.name && embedded.name) entry.name = embedded.name;
        if (!entry.description && embedded.description) entry.description = embedded.description;
      }
    }

    entries.push(entry);
  }

  return entries;
}

export async function scanBundledGlobals(baseDir?: string): Promise<BundledGlobalsListing> {
  const base = baseDir ?? defaultBaseDir();
  const listing: BundledGlobalsListing = {
    shared: await scanDir(base, ''),
    demo: [],
    prd: [],
  };
  for (const scope of SCOPES) {
    const dir = join(base, scope);
    if (existsSync(dir)) listing[scope] = await scanDir(dir, `${scope}/`);
  }
  return listing;
}
