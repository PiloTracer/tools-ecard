/**
 * Bundled Global Templates Service (Pass 5, plan A4.2)
 *
 * Operator-curated global templates shipped as static assets under
 * `public/templates/globals/`: the operator exports a design with the
 * existing Export feature (ZIP package) and drops `<name>.zip` plus an
 * optional same-named preview image into that directory. A checked-in
 * `manifest.json` lists the entries; regenerate it after dropping files with
 * `node scripts/build-global-templates-manifest.mjs` (inside the front-cards
 * container — intentionally NOT wired into package.json).
 *
 * The gallery merges these entries in both Demo and Normal mode: the manifest
 * and ZIPs are static assets, so no auth and no demo-write-guard concerns.
 * Entries are read-only and kind 'template', so opening one arms the Pass 4
 * fork-on-save flow (Save creates a new per-user design).
 *
 * Resilience: manifest fetch failure, missing preview, or a missing/corrupt
 * ZIP skips the entry with a console warning — the gallery never breaks.
 */

import JSZip from 'jszip';
import { templatePackageService } from './templatePackageService';
import type { Template, TemplateKind } from '../types';
import type { TemplateMetadata, LoadedTemplate } from './templateService';

/** Synthetic id prefix for bundled entries (never collides with DB UUIDs). */
export const BUNDLED_TEMPLATE_PREFIX = 'bundled:';

const MANIFEST_URL = '/templates/globals/manifest.json';
const GLOBALS_BASE_URL = '/templates/globals/';

interface ManifestEntry {
  name: string;
  file: string;
  preview?: string;
  description?: string;
}

async function fetchManifest(): Promise<ManifestEntry[]> {
  try {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) {
      console.warn(`[BundledTemplates] Manifest fetch failed (${response.status}) — no bundled globals`);
      return [];
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn('[BundledTemplates] Manifest is not an array — ignoring bundled globals');
      return [];
    }
    return data.filter(
      (e): e is ManifestEntry =>
        !!e && typeof e.name === 'string' && typeof e.file === 'string'
    );
  } catch (error) {
    console.warn('[BundledTemplates] Manifest unavailable — no bundled globals:', error);
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
   * List bundled global templates from the static manifest.
   * Never throws — failures degrade to fewer (or zero) entries.
   */
  async listBundledTemplates(): Promise<TemplateMetadata[]> {
    const entries = await fetchManifest();
    const templates: TemplateMetadata[] = [];

    for (const entry of entries) {
      const zipUrl = `${GLOBALS_BASE_URL}${entry.file}`;
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
        previewUrl: entry.preview ? `${GLOBALS_BASE_URL}${entry.preview}` : undefined,
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
    const zipUrl = `${GLOBALS_BASE_URL}${file}`;

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
