/**
 * Server-side font loader for node-canvas.
 * Resolves the design fonts referenced by template text elements against the
 * api-server font catalog, downloads the files, and registers them with
 * node-canvas so Pango renders the real typefaces instead of substituting.
 *
 * Everything here is best-effort: catalog unreachable, family missing, or
 * download failure -> console.warn and continue. A render job must never
 * crash because of font loading.
 *
 * Auth contract (api-server fontRoutes): GET /api/v1/fonts and
 * GET /api/v1/fonts/:fontId/file use the DEFAULT (optional) authMiddleware —
 * anonymous requests are allowed through and see GLOBAL system fonts only.
 * No token is needed for the system catalog; user-owned fonts are only
 * reachable when their owning userId is supplied as a query param.
 */

import { registerFont } from 'canvas';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { workerConfig } from '../core/config';
import type { TemplateElementJson } from './fabricTemplateRenderer';

export interface FontRequirement {
  fontFamily: string;
  weight: 'bold' | 'normal';
  style: 'italic' | 'normal';
}

interface CatalogFont {
  fontId: string;
  userId: string | null;
  fontFamily: string;
  fontVariant: string;
  seaweedfsFid?: string;
}

const FETCH_TIMEOUT_MS = 5000;

const FONT_EXTENSIONS = new Set(['.woff2', '.woff', '.ttf', '.otf', '.ttc']);

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'font/woff': '.woff',
  'font/woff2': '.woff2',
  'font/collection': '.ttc',
};

// Per-process caches: the catalog rarely changes during a worker's lifetime,
// and registerFont only needs to run once per (family, weight, style) tuple.
let catalogPromise: Promise<CatalogFont[]> | null = null;
const registeredKeys = new Set<string>();
let tempDir: string | null = null;

/**
 * Browser parity (fontService.variantFromTextStyle): 'bold', 700, and '700'
 * all mean bold. TemplateElementJson types fontWeight as string, but template
 * JSON can carry a numeric weight — compare defensively.
 */
export function isBoldFontWeight(fontWeight: unknown): boolean {
  return fontWeight === 'bold' || fontWeight === 700 || fontWeight === '700';
}

/**
 * Unique (fontFamily, weight, style) tuples from text elements that carry a
 * fontFamily, normalized exactly the way drawText builds ctx.font.
 */
export function collectFontRequirements(elements: TemplateElementJson[]): FontRequirement[] {
  const seen = new Set<string>();
  const requirements: FontRequirement[] = [];
  for (const element of elements) {
    if (element.type !== 'text' || !element.fontFamily) continue;
    const weight = isBoldFontWeight(element.fontWeight) ? 'bold' : 'normal';
    const style = element.fontStyle === 'italic' ? 'italic' : 'normal';
    const key = `${element.fontFamily}|${weight}|${style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    requirements.push({ fontFamily: element.fontFamily, weight, style });
  }
  return requirements;
}

/** Browser parity: variantFromTextStyle in front-cards fontService. */
function variantFromWeightAndStyle(
  weight: 'bold' | 'normal',
  style: 'italic' | 'normal'
): 'regular' | 'bold' | 'italic' | 'bold-italic' {
  if (weight === 'bold' && style === 'italic') return 'bold-italic';
  if (weight === 'bold') return 'bold';
  if (style === 'italic') return 'italic';
  return 'regular';
}

/** Browser parity: normalizeFontVariant (`Regular`/`regular`/`BOLD ITALIC` all match). */
function normalizeFontVariant(variant: string): string {
  return variant.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Find a catalog entry for the requested family + variant (case-insensitive
 * family match). Falls back to any variant of the same family, mirroring the
 * browser's resolveFont.
 */
function resolveCatalogFont(
  fontFamily: string,
  variant: string,
  catalog: CatalogFont[]
): CatalogFont | undefined {
  const lower = fontFamily.toLowerCase();
  const sameFamily = catalog.filter((f) => f.fontFamily.toLowerCase() === lower);
  return sameFamily.find((f) => normalizeFontVariant(f.fontVariant) === variant) ?? sameFamily[0];
}

async function fetchCatalog(): Promise<CatalogFont[]> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const response = await fetch(`${workerConfig.internalApiUrl}/api/v1/fonts?scope=all`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`font catalog request failed with status ${response.status}`);
      }
      const body = (await response.json()) as { fonts?: CatalogFont[] };
      return Array.isArray(body.fonts) ? body.fonts : [];
    })();
    // Allow the next render to retry after a transient catalog failure.
    catalogPromise.catch(() => {
      catalogPromise = null;
    });
  }
  return catalogPromise;
}

function fontFileExtension(contentType: string | null, fid?: string): string {
  if (contentType) {
    const ext = CONTENT_TYPE_EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()];
    if (ext) return ext;
  }
  const fidExt = fid ? path.extname(fid).toLowerCase() : '';
  if (FONT_EXTENSIONS.has(fidExt)) return fidExt;
  return '.ttf';
}

async function downloadFontFile(entry: CatalogFont): Promise<string> {
  const url = new URL(`${workerConfig.internalApiUrl}/api/v1/fonts/${entry.fontId}/file`);
  if (entry.userId && entry.userId !== 'GLOBAL') {
    url.searchParams.set('userId', entry.userId);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`font file request failed with status ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-worker-fonts-'));
  }
  const filePath = path.join(tempDir, `${entry.fontId}${fontFileExtension(response.headers.get('content-type'), entry.seaweedfsFid)}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Register every font referenced by the given elements with node-canvas.
 * Registers each tuple once per process; any failure warns and continues so
 * the render proceeds with Pango's fallback faces.
 */
export async function ensureFontsRegistered(elements: TemplateElementJson[]): Promise<void> {
  const requirements = collectFontRequirements(elements);
  if (requirements.length === 0) return;

  let catalog: CatalogFont[];
  try {
    catalog = await fetchCatalog();
  } catch (error) {
    console.warn(
      `[FontLoader] Font catalog unreachable, rendering with fallback fonts: ${(error as Error).message}`
    );
    return;
  }

  for (const requirement of requirements) {
    const key = `${requirement.fontFamily}|${requirement.weight}|${requirement.style}`;
    if (registeredKeys.has(key)) continue;
    try {
      const variant = variantFromWeightAndStyle(requirement.weight, requirement.style);
      const entry = resolveCatalogFont(requirement.fontFamily, variant, catalog);
      if (!entry) {
        // The catalog is process-cached, so a missing family won't appear on
        // retry — mark it to avoid warn spam on every render.
        registeredKeys.add(key);
        console.warn(
          `[FontLoader] Font not found in catalog: ${requirement.fontFamily} (${variant}), rendering with fallback`
        );
        continue;
      }
      const filePath = await downloadFontFile(entry);
      registerFont(filePath, {
        family: requirement.fontFamily,
        weight: requirement.weight,
        style: requirement.style,
      });
      // Mark only after a successful registration: a transient download or
      // registerFont failure must be retried on the next render.
      registeredKeys.add(key);
    } catch (error) {
      console.warn(
        `[FontLoader] Failed to register font ${requirement.fontFamily} (${requirement.weight}/${requirement.style}): ${(error as Error).message}`
      );
    }
  }
}
