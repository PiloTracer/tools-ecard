/**
 * @jest-environment jsdom
 */

import {
  fontService,
  normalizeFontVariant,
  variantFromTextStyle,
} from './fontService';
import type { Font } from './fontService';
import type { TextElement } from '../types';

jest.mock('@/features/demo/isDemoMode', () => ({
  isDemoMode: jest.fn(() => true),
}));

jest.mock('@/features/demo/demoFontRepository', () => ({
  demoFontRepository: {
    listFonts: jest.fn(),
    loadFont: jest.fn(),
    uploadFont: jest.fn(),
    deleteFont: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isDemoMode } = require('@/features/demo/isDemoMode');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { demoFontRepository } = require('@/features/demo/demoFontRepository');

function makeFont(overrides: Partial<Font> = {}): Font {
  return {
    fontId: 'f1',
    userId: null,
    fontName: 'Custom Sans',
    fontFamily: 'Custom Sans',
    fontCategory: 'sans-serif',
    fontVariant: 'Regular',
    fontWeight: 400,
    fontStyle: 'normal',
    isSystemFont: false,
    ...overrides,
  };
}

/** Access the singleton's private state without `any`. */
function resetFontServiceState(): void {
  const svc = fontService as unknown as {
    loadedFonts: Set<string>;
    fontSynthesisInjected: boolean;
  };
  svc.loadedFonts.clear();
  svc.fontSynthesisInjected = false;
}

const globalScope = globalThis as { FontFace?: unknown };

function deleteDocumentFonts(): void {
  delete (document as unknown as { fonts?: unknown }).fonts;
}

function textEl(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'el1',
    type: 'text',
    text: 'Hello',
    x: 0,
    y: 0,
    fontSize: 16,
    fontFamily: 'Custom Sans',
    ...overrides,
  } as TextElement;
}

describe('fontService helpers', () => {
  it('normalizes variant casing', () => {
    expect(normalizeFontVariant('Regular')).toBe('regular');
    expect(normalizeFontVariant('BOLD-ITALIC')).toBe('bold-italic');
  });

  it('derives variant from text style', () => {
    expect(variantFromTextStyle('bold', 'normal')).toBe('bold');
    expect(variantFromTextStyle('normal', 'italic')).toBe('italic');
  });
});

describe('fontService.resolveFont', () => {
  const catalog = [
    {
      fontId: 'f1',
      userId: null,
      fontName: 'Custom Sans',
      fontFamily: 'Custom Sans',
      fontCategory: 'sans-serif',
      fontVariant: 'Regular',
      fontWeight: 400,
      fontStyle: 'normal',
      isSystemFont: false,
    },
  ];

  it('matches family when catalog variant casing differs', () => {
    const found = fontService.resolveFont('Custom Sans', 'regular', catalog);
    expect(found?.fontId).toBe('f1');
  });
});

describe('fontService.preloadFontsForElements', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    demoFontRepository.listFonts.mockResolvedValue([]);
    await fontService.listFonts('all');
    demoFontRepository.loadFont.mockResolvedValue(undefined);
  });

  it('loads fonts even when catalog stores Regular but element requests regular', async () => {
    demoFontRepository.listFonts.mockResolvedValue([
      {
        fontId: 'f1',
        userId: 'demo',
        fontName: 'Custom Sans',
        fontFamily: 'Custom Sans',
        fontCategory: 'sans-serif',
        fontVariant: 'Regular',
        fontWeight: 400,
        fontStyle: 'normal',
        isSystemFont: false,
      },
    ]);
    await fontService.preloadFontsForElements([textEl()]);
    expect(demoFontRepository.loadFont).toHaveBeenCalledTimes(1);
    expect(demoFontRepository.loadFont).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: 'Custom Sans', fontVariant: 'Regular' })
    );
  });

  it('refreshes the catalog when the first lookup misses', async () => {
    demoFontRepository.listFonts.mockReset();
    demoFontRepository.listFonts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          fontId: 'f1',
          fontFamily: 'Custom Sans',
          fontVariant: 'regular',
          fontWeight: 400,
          fontStyle: 'normal',
          isSystemFont: false,
        },
      ]);
    await fontService.preloadFontsForElements([textEl()]);
    expect(demoFontRepository.listFonts).toHaveBeenCalledTimes(2);
    expect(demoFontRepository.loadFont).toHaveBeenCalled();
  });

  it('waits on document.fonts with the exact weight/style variant requested', async () => {
    const fontsLoad = jest.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', {
      value: { load: fontsLoad, ready: Promise.resolve() },
      configurable: true,
    });
    try {
      demoFontRepository.listFonts.mockResolvedValue([
        makeFont({ fontId: 'fb', fontVariant: 'Bold', fontWeight: 700 }),
      ]);
      await fontService.preloadFontsForElements([textEl({ fontWeight: 'bold' })]);
      expect(fontsLoad).toHaveBeenCalledWith('normal 700 16px "Custom Sans"');
    } finally {
      deleteDocumentFonts();
    }
  });
});

describe('fontService.loadFont (Font Loading API path)', () => {
  let fontFaceInstances: Array<{
    family: string;
    source: string;
    descriptors: { weight: string; style: string };
    load: jest.Mock;
  }>;
  let fontsAdd: jest.Mock;
  let originalFontFace: unknown;

  beforeEach(() => {
    resetFontServiceState();
    document.head.innerHTML = '';
    isDemoMode.mockReturnValue(false);
    fontFaceInstances = [];
    originalFontFace = globalScope.FontFace;
    globalScope.FontFace = class MockFontFace {
      family: string;
      source: string;
      descriptors: { weight: string; style: string };
      load: jest.Mock;
      constructor(family: string, source: string, descriptors: { weight: string; style: string }) {
        this.family = family;
        this.source = source;
        this.descriptors = descriptors;
        this.load = jest.fn().mockResolvedValue(this);
        fontFaceInstances.push(this);
      }
    };
    fontsAdd = jest.fn();
    Object.defineProperty(document, 'fonts', {
      value: { add: fontsAdd, load: jest.fn().mockResolvedValue([]), ready: Promise.resolve() },
      configurable: true,
    });
  });

  afterEach(() => {
    globalScope.FontFace = originalFontFace;
    deleteDocumentFonts();
    isDemoMode.mockReturnValue(true);
  });

  it('awaits FontFace.load and registers the exact weight/style', async () => {
    await fontService.loadFont(
      makeFont({ fontVariant: 'Bold Italic', fontWeight: 700, fontStyle: 'italic' })
    );
    expect(fontFaceInstances).toHaveLength(1);
    const face = fontFaceInstances[0];
    expect(face.family).toBe('Custom Sans');
    expect(face.source).toContain('/api/v1/fonts/f1/file');
    expect(face.descriptors).toEqual({ weight: '700', style: 'italic' });
    expect(face.load).toHaveBeenCalledTimes(1);
    expect(fontsAdd).toHaveBeenCalledWith(face);
    expect(fontService.isFontLoaded('Custom Sans', 700, 'italic')).toBe(true);
  });

  it('marks the font as loaded only after FontFace.load() resolves', async () => {
    let resolveLoad!: (value: unknown) => void;
    globalScope.FontFace = class DeferredFontFace {
      load: jest.Mock;
      constructor(
        public family: string,
        public source: string,
        public descriptors: { weight: string; style: string }
      ) {
        this.load = jest.fn(() => new Promise((resolve) => { resolveLoad = resolve; }));
      }
    };
    const promise = fontService.loadFont(
      makeFont({ fontFamily: 'Deferred Sans' })
    );
    await Promise.resolve(); // flush microtasks up to the await on face.load()
    expect(fontService.isFontLoaded('Deferred Sans', 400, 'normal')).toBe(false);
    resolveLoad({});
    await promise;
    expect(fontService.isFontLoaded('Deferred Sans', 400, 'normal')).toBe(true);
  });

  it('still injects the one-time font-synthesis CSS block', async () => {
    await fontService.loadFont(
      makeFont({ fontFamily: 'Synthesis Sans' })
    );
    const css = Array.from(document.head.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n');
    expect(css).toContain('font-synthesis: none');
    expect(css).not.toContain('font-display');
  });
});

describe('fontService.loadFont (style-tag fallback without FontFace)', () => {
  beforeEach(() => {
    resetFontServiceState();
    document.head.innerHTML = '';
    isDemoMode.mockReturnValue(false);
    delete globalScope.FontFace;
    deleteDocumentFonts();
  });

  afterEach(() => {
    isDemoMode.mockReturnValue(true);
  });

  it('injects @font-face without font-display and marks the font loaded', async () => {
    await fontService.loadFont(
      makeFont({ fontFamily: 'Fallback Sans' })
    );
    const css = Array.from(document.head.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n');
    expect(css).toContain('@font-face');
    expect(css).toContain("font-family: 'Fallback Sans'");
    expect(css).not.toContain('font-display');
    expect(css).toContain('font-synthesis: none');
    expect(fontService.isFontLoaded('Fallback Sans', 400, 'normal')).toBe(true);
  });
});
