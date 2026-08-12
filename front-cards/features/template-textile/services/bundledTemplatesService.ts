/**
 * Bundled Global Templates Service (Pass 5, plan A4.2)
 *
 * Operator-curated global templates shipped as static assets under
 * `public/templates/globals/`: the operator exports a design with the
 * existing Export feature (which downloads `<name>.zip` + `<name>.png`
 * preview + `<name>.json` sidecar) and drops the files into the target
 * directory. The front-cards server lists the directories live via
 * `GET /api/bundled-templates` (bundledGlobalsScanner) — no manifest file,
 * nothing to regenerate.
 *
 * Per-site sets: `globals/demo/` is listed only on the demo site and
 * `globals/prd/` only on the production site; the root `globals/` directory
 * is shared by both. This lets one repo/checkout serve different bundled
 * sets to each deployment.
 *
 * The gallery merges these entries in both Demo and Normal mode: the listing
 * and ZIPs are static/public, so no auth and no demo-write-guard concerns.
 * Entries are read-only and kind 'template', so opening one arms the Pass 4
 * fork-on-save flow (Save creates a new per-user design).
 *
 * Resilience: listing fetch failure, missing preview, or a missing/corrupt
 * ZIP skips the entry with a console warning — the gallery never breaks.
 */

import JSZip from 'jszip';
import { templatePackageService } from './templatePackageService';
import { isDemoMode } from '@/features/demo/isDemoMode';
import type { BundledGlobalEntry } from './bundledGlobalsScanner';
import type { Template, TemplateKind } from '../types';
import type { TemplateMetadata, LoadedTemplate } from './templateService';

/** Synthetic id prefix for bundled entries (never collides with DB UUIDs). */
export const BUNDLED_TEMPLATE_PREFIX = 'bundled:';

const LISTING_URL = '/api/bundled-templates';
const FILE_BASE_URL = '/api/bundled-templates/file/';

/**
 * Files are served through the dynamic route (not /templates/globals/ static
 * paths) because Next's standalone server only serves public/ files that
 * existed at process start — the dynamic route reads the host-mounted dir
 * live, so operator-dropped files work with no rebuild and no restart.
 */
function fileUrl(file: string): string {
  return `${FILE_BASE_URL}${file.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Per-site sets: the demo site lists `globals/demo/` and the production site
 * lists `globals/prd/`; entries in the shared root `globals/` are listed on
 * both.
 */
function envScope(): 'demo' | 'prd' {
  return isDemoMode() ? 'demo' : 'prd';
}

/**
 * Fetch the live directory listing and keep the entries for this site
 * (shared root + the env-scoped group). Entry files already carry their
 * scope dir (e.g. "demo/A.zip"), so they resolve under GLOBALS_BASE_URL.
 */
async function fetchSiteEntries(): Promise<BundledGlobalEntry[]> {
  try {
    const response = await fetch(LISTING_URL, { cache: 'no-store' });
    if (!response.ok) {
      console.warn(`[BundledTemplates] Listing fetch failed (${response.status}) — no bundled globals`);
      return [];
    }
    const data = await response.json();
    const isValid = (e: unknown): e is BundledGlobalEntry =>
      !!e && typeof (e as BundledGlobalEntry).name === 'string' &&
      typeof (e as BundledGlobalEntry).file === 'string';
    const shared = Array.isArray(data?.shared) ? data.shared.filter(isValid) : [];
    const scoped = Array.isArray(data?.[envScope()]) ? data[envScope()].filter(isValid) : [];
    return [...shared, ...scoped];
  } catch (error) {
    console.warn('[BundledTemplates] Listing unavailable — no bundled globals:', error);
    return [];
  }
}

/** Lightweight integrity check: the ZIP must load and contain template.json. */
async function zipContainsTemplate(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const buffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    return zip.file('template.json') !== null;
  } catch {
    return false;
  }
}

export const bundledTemplatesService = {
  /**
   * List bundled global templates from the live directory listing.
   * Never throws — failures degrade to fewer (or zero) entries.
   */
  async listBundledTemplates(): Promise<TemplateMetadata[]> {
    const entries = await fetchSiteEntries();
    const templates: TemplateMetadata[] = [];

    for (const entry of entries) {
      // entry.file already carries the scope dir (e.g. "demo/A.zip"), so it
      // doubles as the id suffix; URLs go through the live file route.
      const zipUrl = fileUrl(entry.file);
      if (!(await zipContainsTemplate(zipUrl))) {
        console.warn(
          `[BundledTemplates] Skipping "${entry.name}" — missing or corrupt ZIP: ${entry.file}`
        );
        continue;
      }

      templates.push({
        id: `${BUNDLED_TEMPLATE_PREFIX}${entry.file}`,
        userId: 'global',
        name: entry.name,
        storageUrl: zipUrl,
        storageMode: 'LOCAL_ONLY',
        resourceUrls: [],
        version: 1,
        kind: 'template' as TemplateKind,
        isBundled: true,
        previewUrl: entry.preview ? fileUrl(entry.preview) : undefined,
        description: entry.description,
        createdAt: new Date(0),
        updatedAt: new Date(0)
      });
    }

    return templates;
  },

  /**
   * Load a bundled global template: fetch the ZIP and import it through the
   * same JSZip package path used by the editor's Import feature.
   */
  async loadBundledTemplate(templateId: string): Promise<LoadedTemplate> {
    const file = templateId.slice(BUNDLED_TEMPLATE_PREFIX.length);
    const zipUrl = fileUrl(file);

    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`Bundled template not found: ${file}`);
    }
    const blob = await response.blob();
    const zipFile = new File([blob], file);

    const data: Template = await templatePackageService.importPackage(zipFile);

    return {
      id: templateId,
      userId: 'global',
      name: data.name,
      data,
      resources: [],
      metadata: {
        id: templateId,
        userId: 'global',
        name: data.name,
        storageUrl: zipUrl,
        storageMode: 'LOCAL_ONLY',
        resourceUrls: [],
        version: 1,
        kind: 'template',
        isBundled: true,
        createdAt: new Date(0),
        updatedAt: new Date(0)
      }
    };
  }
};
