/**
 * Pass 5 — bundledTemplatesService: manifest parsing, corrupt/missing ZIP
 * resilience, and loading through the real JSZip package import path.
 */
import JSZip from 'jszip';
import { bundledTemplatesService, BUNDLED_TEMPLATE_PREFIX } from './bundledTemplatesService';

const mockFetch = jest.fn();
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true });

async function makeTemplateZipBuffer(name = 'Bundled Card'): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    'template.json',
    JSON.stringify({ name, width: 1000, height: 600, elements: [] })
  );
  zip.file(
    'package.json',
    JSON.stringify({ version: '1.0', exportDate: '2026-08-12T00:00:00Z', customFonts: [], images: [] })
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

function okResponse(overrides: Record<string, unknown> = {}) {
  return { ok: true, status: 200, ...overrides };
}

describe('bundledTemplatesService (Pass 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore?.();
  });

  it('lists valid entries with preview URLs and skips corrupt or missing ZIPs', async () => {
    const goodZip = await makeTemplateZipBuffer();
    const manifest = [
      { name: 'Good Card', file: 'good.zip', preview: 'good.png', description: 'Starter' },
      { name: 'No Preview', file: 'plain.zip' },
      { name: 'Corrupt', file: 'corrupt.zip' },
      { name: 'Missing', file: 'missing.zip' },
    ];

    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/templates/globals/manifest.json') {
        return okResponse({ json: async () => manifest });
      }
      if (url === '/templates/globals/good.zip') {
        return okResponse({ arrayBuffer: async () => goodZip });
      }
      if (url === '/templates/globals/plain.zip') {
        return okResponse({ arrayBuffer: async () => goodZip });
      }
      if (url === '/templates/globals/corrupt.zip') {
        return okResponse({ arrayBuffer: async () => new TextEncoder().encode('not a zip').buffer });
      }
      return { ok: false, status: 404 };
    });

    const list = await bundledTemplatesService.listBundledTemplates();

    expect(list.map(t => t.name)).toEqual(['Good Card', 'No Preview']);
    expect(list[0]).toMatchObject({
      id: `${BUNDLED_TEMPLATE_PREFIX}good.zip`,
      kind: 'template',
      isBundled: true,
      previewUrl: '/templates/globals/good.png',
      description: 'Starter',
    });
    expect(list[1].previewUrl).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Corrupt')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing')
    );
  });

  it('returns [] when the manifest fetch fails (never breaks the gallery)', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    await expect(bundledTemplatesService.listBundledTemplates()).resolves.toEqual([]);
  });

  it('returns [] when the manifest is not an array', async () => {
    mockFetch.mockResolvedValue(okResponse({ json: async () => ({ not: 'an array' }) }));

    await expect(bundledTemplatesService.listBundledTemplates()).resolves.toEqual([]);
  });

  it('loads a bundled template through the real JSZip import path', async () => {
    const zipBuffer = await makeTemplateZipBuffer('Bundled Card');
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/templates/globals/good.zip') {
        return okResponse({
          arrayBuffer: async () => zipBuffer,
          blob: async () => new Blob([zipBuffer]),
        });
      }
      return { ok: false, status: 404 };
    });

    const loaded = await bundledTemplatesService.loadBundledTemplate(
      `${BUNDLED_TEMPLATE_PREFIX}good.zip`
    );

    expect(loaded.id).toBe(`${BUNDLED_TEMPLATE_PREFIX}good.zip`);
    expect(loaded.name).toBe('Bundled Card');
    expect(loaded.data.width).toBe(1000);
    expect(loaded.metadata.kind).toBe('template');
    expect(loaded.metadata.isBundled).toBe(true);
  });

  it('throws when the bundled ZIP is not found', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(
      bundledTemplatesService.loadBundledTemplate(`${BUNDLED_TEMPLATE_PREFIX}missing.zip`)
    ).rejects.toThrow('Bundled template not found');
  });
});
