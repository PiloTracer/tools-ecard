/**
 * fontLoader tests: tuple collection/dedup, catalog variant mapping with
 * same-family fallback, registerFont wiring, per-process caching, and
 * warn-and-continue on failures. global.fetch and canvas.registerFont are
 * mocked; no network or real font files are touched.
 */

import * as path from 'path';

const mockRegisterFont = jest.fn();

jest.mock('canvas', () => ({
  registerFont: (...args: unknown[]) => mockRegisterFont(...args),
}));

type FontLoaderModule = typeof import('../src/services/fontLoader');

const CATALOG = [
  { fontId: 'f-regular', userId: 'GLOBAL', fontFamily: 'Acme Sans', fontVariant: 'regular', seaweedfsFid: 'acme-regular.ttf' },
  { fontId: 'f-bold', userId: 'GLOBAL', fontFamily: 'Acme Sans', fontVariant: 'bold', seaweedfsFid: 'acme-bold.ttf' },
  { fontId: 'f-bold-italic', userId: 'GLOBAL', fontFamily: 'Acme Sans', fontVariant: 'bold-italic', seaweedfsFid: 'acme-bi.otf' },
  // Only a `Regular`-labeled variant exists — exercises the same-family fallback.
  { fontId: 'f-mono', userId: 'GLOBAL', fontFamily: 'Solo Mono', fontVariant: 'Regular', seaweedfsFid: 'solo.ttf' },
];

function installFetchMock(options: { catalogError?: boolean } = {}) {
  const fetchMock = jest.fn(async (input: unknown): Promise<any> => {
    const url = String(input);
    if (url.includes('/api/v1/fonts?scope=all')) {
      if (options.catalogError) throw new Error('connect ECONNREFUSED');
      return { ok: true, json: async () => ({ fonts: CATALOG }) };
    }
    if (/\/api\/v1\/fonts\/[^/]+\/file/.test(url)) {
      return {
        ok: true,
        headers: { get: () => 'font/ttf' },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  (global as any).fetch = fetchMock;
  return fetchMock;
}

let fontLoader: FontLoaderModule;

beforeEach(() => {
  jest.resetModules();
  mockRegisterFont.mockClear();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fontLoader = require('../src/services/fontLoader');
});

describe('collectFontRequirements', () => {
  it('collects unique normalized (family, weight, style) tuples from text elements', () => {
    const requirements = fontLoader.collectFontRequirements([
      { id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans' },
      { id: 'b', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans' }, // duplicate
      { id: 'c', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans', fontWeight: 'bold' },
      { id: 'd', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans', fontWeight: 'bold', fontStyle: 'italic' },
      { id: 'e', type: 'text', x: 0, y: 0 }, // no fontFamily — skipped
      { id: 'f', type: 'shape', x: 0, y: 0, fontFamily: 'Ignored' }, // non-text — skipped
    ]);

    expect(requirements).toEqual([
      { fontFamily: 'Acme Sans', weight: 'normal', style: 'normal' },
      { fontFamily: 'Acme Sans', weight: 'bold', style: 'normal' },
      { fontFamily: 'Acme Sans', weight: 'bold', style: 'italic' },
    ]);
  });

  it('returns an empty list when no text element carries a fontFamily', () => {
    expect(
      fontLoader.collectFontRequirements([{ id: 'a', type: 'text', x: 0, y: 0, text: 'Hi' }])
    ).toEqual([]);
  });

  it('maps string and numeric 700 fontWeight to bold (browser parity)', () => {
    const requirements = fontLoader.collectFontRequirements([
      { id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans', fontWeight: '700' },
      // Numeric weight: TemplateElementJson types fontWeight as string, but
      // template JSON can carry a number — same tuple as '700'.
      { id: 'b', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans', fontWeight: 700 as unknown as string },
      { id: 'c', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans', fontWeight: '400' },
    ]);

    expect(requirements).toEqual([
      { fontFamily: 'Acme Sans', weight: 'bold', style: 'normal' },
      { fontFamily: 'Acme Sans', weight: 'normal', style: 'normal' },
    ]);
  });
});

describe('ensureFontsRegistered', () => {
  it('registers each tuple with the exact requested family/weight/style and the matching variant file', async () => {
    installFetchMock();

    await fontLoader.ensureFontsRegistered([
      { id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans' },
      { id: 'b', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans', fontWeight: 'bold' },
      { id: 'c', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans', fontWeight: 'bold', fontStyle: 'italic' },
    ]);

    expect(mockRegisterFont).toHaveBeenCalledTimes(3);
    expect(mockRegisterFont.mock.calls[0][1]).toEqual({ family: 'Acme Sans', weight: 'normal', style: 'normal' });
    expect(mockRegisterFont.mock.calls[1][1]).toEqual({ family: 'Acme Sans', weight: 'bold', style: 'normal' });
    expect(mockRegisterFont.mock.calls[2][1]).toEqual({ family: 'Acme Sans', weight: 'bold', style: 'italic' });
    // The downloaded file belongs to the mapped catalog variant (regular|bold|bold-italic).
    expect(path.basename(mockRegisterFont.mock.calls[0][0])).toBe('f-regular.ttf');
    expect(path.basename(mockRegisterFont.mock.calls[1][0])).toBe('f-bold.ttf');
    expect(path.basename(mockRegisterFont.mock.calls[2][0])).toBe('f-bold-italic.ttf'); // content-type ext wins over fid .otf
  });

  it('matches families case-insensitively', async () => {
    installFetchMock();

    await fontLoader.ensureFontsRegistered([
      { id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'acme sans' },
    ]);

    expect(mockRegisterFont).toHaveBeenCalledTimes(1);
    expect(mockRegisterFont.mock.calls[0][1]).toEqual({ family: 'acme sans', weight: 'normal', style: 'normal' });
    expect(path.basename(mockRegisterFont.mock.calls[0][0])).toBe('f-regular.ttf');
  });

  it('falls back to any variant of the same family when the exact variant is missing', async () => {
    installFetchMock();

    await fontLoader.ensureFontsRegistered([
      { id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'Solo Mono', fontStyle: 'italic' },
    ]);

    expect(mockRegisterFont).toHaveBeenCalledTimes(1);
    // Registered under the requested style so ctx.font lookups hit it...
    expect(mockRegisterFont.mock.calls[0][1]).toEqual({ family: 'Solo Mono', weight: 'normal', style: 'italic' });
    // ...but backed by the only variant the family has (`Regular` label normalizes to `regular`).
    expect(path.basename(mockRegisterFont.mock.calls[0][0])).toBe('f-mono.ttf');
  });

  it('fetches the catalog once per process and registers each tuple once', async () => {
    const fetchMock = installFetchMock();
    const elements = [{ id: 'a', type: 'text' as const, x: 0, y: 0, fontFamily: 'Acme Sans' }];

    await fontLoader.ensureFontsRegistered(elements);
    await fontLoader.ensureFontsRegistered(elements);

    const catalogCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('scope=all'));
    expect(catalogCalls).toHaveLength(1);
    expect(mockRegisterFont).toHaveBeenCalledTimes(1);
  });

  it('warns and continues when the catalog is unreachable', async () => {
    installFetchMock({ catalogError: true });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      fontLoader.ensureFontsRegistered([{ id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans' }])
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('catalog unreachable'));
    expect(mockRegisterFont).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns and continues when the family is missing from the catalog', async () => {
    installFetchMock();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      fontLoader.ensureFontsRegistered([{ id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'No Such Family' }])
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No Such Family'));
    expect(mockRegisterFont).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns and continues when a font file download fails', async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockImplementation(async (input: unknown): Promise<any> => {
      const url = String(input);
      if (url.includes('/api/v1/fonts?scope=all')) {
        return { ok: true, json: async () => ({ fonts: CATALOG }) };
      }
      return { ok: false, status: 500 };
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      fontLoader.ensureFontsRegistered([{ id: 'a', type: 'text', x: 0, y: 0, fontFamily: 'Acme Sans' }])
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to register font Acme Sans'));
    expect(mockRegisterFont).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('retries registration on the next render after a transient download failure', async () => {
    const fetchMock = installFetchMock();
    const elements = [{ id: 'a', type: 'text' as const, x: 0, y: 0, fontFamily: 'Acme Sans' }];
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // First render: the font file download fails transiently.
    fetchMock.mockImplementation(async (input: unknown): Promise<any> => {
      const url = String(input);
      if (url.includes('/api/v1/fonts?scope=all')) {
        return { ok: true, json: async () => ({ fonts: CATALOG }) };
      }
      return { ok: false, status: 500 };
    });
    await fontLoader.ensureFontsRegistered(elements);
    expect(mockRegisterFont).not.toHaveBeenCalled();

    // Second render: the download recovers — the tuple must NOT have been
    // poisoned by the first failure, so registration runs now.
    installFetchMock();
    await fontLoader.ensureFontsRegistered(elements);

    expect(mockRegisterFont).toHaveBeenCalledTimes(1);
    expect(mockRegisterFont.mock.calls[0][1]).toEqual({ family: 'Acme Sans', weight: 'normal', style: 'normal' });
    warn.mockRestore();
  });
});
