/**
 * Pass 5 — bundledTemplatesService: manifest parsing, corrupt/missing ZIP
 * resilience, and loading through the real JSZip package import path.
 */
import JSZip from 'jszip';
import { bundledTemplatesService, BUNDLED_TEMPLATE_PREFIX } from './bundledTemplatesService';

const mockFetch = jest.fn();
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true });

async function makeTemplateZipBuffer(
  name = 'Bundled Card',
  opts: { embeddedPreview?: boolean; description?: string } = {}
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    'template.json',
    JSON.stringify({ name, width: 1000, height: 600, elements: [] })
  );
  zip.file(
    'package.json',
    JSON.stringify({ version: '1.0', exportDate: '2026-08-12T00:00:00Z', customFonts: [], images: [] })
  );
  if (opts.embeddedPreview) {
    zip.file('preview.png', Buffer.from('fake-png'));
    zip.file('sidecar.json', JSON.stringify({ name, description: opts.description }, null, 2));
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

function okResponse(overrides: Record<string, unknown> = {}) {
  return { ok: true, status: 200, ...overrides };
}

describe('bundledTemplatesService (Pass 5)', () => {
  // The dev container exports NEXT_PUBLIC_DEMO_MODE=true; neutralize it so each
  // test controls the site scope explicitly (localStorage flag = demo).
  const savedDemoEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = '';
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore?.();
  });

  afterAll(() => {
    if (savedDemoEnv === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = savedDemoEnv;
  });

  it('lists valid entries with preview URLs and skips corrupt or missing ZIPs', async () => {
    const goodZip = await makeTemplateZipBuffer();
    const listing = {
      shared: [
        { name: 'Good Card', file: 'good.zip', preview: 'good.png', description: 'Starter' },
        { name: 'No Preview', file: 'plain.zip' },
        { name: 'Corrupt', file: 'corrupt.zip' },
        { name: 'Missing', file: 'missing.zip' },
      ],
      demo: [],
      prd: [],
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/bundled-templates') {
        return okResponse({ json: async () => listing });
      }
      if (url === '/api/bundled-templates/file/good.zip') {
        return okResponse({ arrayBuffer: async () => goodZip });
      }
      if (url === '/api/bundled-templates/file/plain.zip') {
        return okResponse({ arrayBuffer: async () => goodZip });
      }
      if (url === '/api/bundled-templates/file/corrupt.zip') {
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
      previewUrl: '/api/bundled-templates/file/good.png',
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

  it('returns [] when the listing fetch fails (never breaks the gallery)', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    await expect(bundledTemplatesService.listBundledTemplates()).resolves.toEqual([]);
  });

  it('returns [] when the listing payload is malformed', async () => {
    mockFetch.mockResolvedValue(
      okResponse({ json: async () => ({ shared: 'nope', demo: 42, prd: null }) })
    );

    await expect(bundledTemplatesService.listBundledTemplates()).resolves.toEqual([]);
  });

  it('loads a bundled template through the real JSZip import path', async () => {
    const zipBuffer = await makeTemplateZipBuffer('Bundled Card');
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/bundled-templates/file/good.zip') {
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

  it('merges the shared root set with the prd-scoped set (default site)', async () => {
    const goodZip = await makeTemplateZipBuffer();
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/bundled-templates') {
        return okResponse({
          json: async () => ({
            shared: [{ name: 'Shared Card', file: 'shared.zip' }],
            demo: [{ name: 'Demo Card', file: 'demo/a.zip' }],
            prd: [{ name: 'Prd Card', file: 'prd/c.zip', preview: 'prd/c.png' }],
          }),
        });
      }
      if (url === '/api/bundled-templates/file/shared.zip' || url === '/api/bundled-templates/file/prd/c.zip') {
        return okResponse({ arrayBuffer: async () => goodZip });
      }
      return { ok: false, status: 404 };
    });

    const list = await bundledTemplatesService.listBundledTemplates();

    // The demo group must NOT leak into the prd site listing.
    expect(list.map((t) => t.name)).toEqual(['Shared Card', 'Prd Card']);
    expect(list[0]).toMatchObject({
      id: `${BUNDLED_TEMPLATE_PREFIX}shared.zip`,
      storageUrl: '/api/bundled-templates/file/shared.zip',
    });
    expect(list[1]).toMatchObject({
      id: `${BUNDLED_TEMPLATE_PREFIX}prd/c.zip`,
      storageUrl: '/api/bundled-templates/file/prd/c.zip',
      previewUrl: '/api/bundled-templates/file/prd/c.png',
    });
  });

  it('uses the ZIP-extract URL when the preview is embedded in the ZIP', async () => {
    const embeddedZip = await makeTemplateZipBuffer('Embedded Preview Card', {
      embeddedPreview: true,
      description: 'Embedded description',
    });
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/bundled-templates') {
        return okResponse({
          json: async () => ({
            shared: [
              {
                name: 'Embedded Preview Card',
                file: 'embedded.zip',
                previewInZip: true,
                description: 'Embedded description',
              },
            ],
            demo: [],
            prd: [],
          }),
        });
      }
      if (url === '/api/bundled-templates/file/embedded.zip') {
        return okResponse({ arrayBuffer: async () => embeddedZip });
      }
      return { ok: false, status: 404 };
    });

    const list = await bundledTemplatesService.listBundledTemplates();

    expect(list.map((t) => t.name)).toEqual(['Embedded Preview Card']);
    expect(list[0]).toMatchObject({
      id: `${BUNDLED_TEMPLATE_PREFIX}embedded.zip`,
      previewUrl: '/api/bundled-templates/file/embedded.zip?extract=preview.png',
      description: 'Embedded description',
    });
  });

  it('lists the demo-scoped set (not the prd one) when demo mode is on', async () => {
    window.localStorage.setItem('ecards:demo:enabled', '1');
    try {
      const goodZip = await makeTemplateZipBuffer();
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/bundled-templates') {
          return okResponse({
            json: async () => ({
              shared: [],
              demo: [{ name: 'Demo Card', file: 'demo/a.zip' }],
              prd: [{ name: 'Prd Card', file: 'prd/c.zip' }],
            }),
          });
        }
        if (url === '/api/bundled-templates/file/demo/a.zip') {
          return okResponse({ arrayBuffer: async () => goodZip });
        }
        return { ok: false, status: 404 };
      });

      const list = await bundledTemplatesService.listBundledTemplates();

      // The prd group must NOT leak into the demo site listing.
      expect(list.map((t) => t.name)).toEqual(['Demo Card']);
      expect(list[0]).toMatchObject({
        id: `${BUNDLED_TEMPLATE_PREFIX}demo/a.zip`,
        storageUrl: '/api/bundled-templates/file/demo/a.zip',
      });

      // Loading resolves the scope-relative id back to the scoped URL.
      const zipBuffer = await makeTemplateZipBuffer('Demo Card');
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/bundled-templates/file/demo/a.zip') {
          return okResponse({
            arrayBuffer: async () => zipBuffer,
            blob: async () => new Blob([zipBuffer]),
          });
        }
        return { ok: false, status: 404 };
      });
      const loaded = await bundledTemplatesService.loadBundledTemplate(
        `${BUNDLED_TEMPLATE_PREFIX}demo/a.zip`
      );
      expect(loaded.name).toBe('Demo Card');
    } finally {
      window.localStorage.removeItem('ecards:demo:enabled');
    }
  });
});
