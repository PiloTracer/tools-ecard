/**
 * @jest-environment jsdom
 */

import { preloadTemplateFonts, fitTextToSafeArea } from './exportService';
import type { TextElement } from '../types';

jest.mock('./fontService', () => ({
  fontService: {
    preloadFontsForElements: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fontService } = require('./fontService');

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

describe('preloadTemplateFonts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fontService.preloadFontsForElements.mockResolvedValue(undefined);
  });

  it('delegates to fontService.preloadFontsForElements', async () => {
    const elements = [textEl()];
    await preloadTemplateFonts(elements);
    expect(fontService.preloadFontsForElements).toHaveBeenCalledWith(elements);
  });
});

interface FakeBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FakeTextObject {
  type: string;
  text: string;
  scaleX: number;
  scaleY: number;
  isBackgroundRect?: boolean;
  getBoundingRect: () => FakeBounds;
}

function makeTextObj(bounds: FakeBounds, overrides: Record<string, unknown> = {}): FakeTextObject {
  return {
    type: 'text',
    text: 'Hello',
    scaleX: 1,
    scaleY: 1,
    getBoundingRect: () => ({ ...bounds }),
    ...overrides,
  } as FakeTextObject;
}

function makeCanvas(objects: FakeTextObject[], width = 1200, height = 600) {
  return {
    width,
    height,
    getObjects: () => objects,
    renderAll: jest.fn(),
  } as unknown as Parameters<typeof fitTextToSafeArea>[0];
}

describe('fitTextToSafeArea', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('shrinks text that overflows the right edge of the safe area', () => {
    // left=100, width=1200 → right edge 1300 > 1170; factor = 1070/1200
    const obj = makeTextObj({ left: 100, top: 100, width: 1200, height: 40 });
    fitTextToSafeArea(makeCanvas([obj]), 30);
    const expected = 1070 / 1200;
    expect(obj.scaleX).toBeCloseTo(expected, 5);
    expect(obj.scaleY).toBeCloseTo(expected, 5);
  });

  it('never shrinks below the 0.5 floor on extreme right overflow', () => {
    const obj = makeTextObj({ left: 100, top: 100, width: 5000, height: 40 });
    fitTextToSafeArea(makeCanvas([obj]), 30);
    expect(obj.scaleX).toBe(0.5);
    expect(obj.scaleY).toBe(0.5);
  });

  it('shrinks text that overflows the left edge (width basis)', () => {
    // left=10 < 30 → available 1140 / width 2000 = 0.57
    const obj = makeTextObj({ left: 10, top: 100, width: 2000, height: 40 });
    fitTextToSafeArea(makeCanvas([obj]), 30);
    expect(obj.scaleX).toBeCloseTo(0.57, 5);
    expect(obj.scaleY).toBeCloseTo(0.57, 5);
  });

  it('does NOT shrink text that only violates the top edge', () => {
    const obj = makeTextObj({ left: 100, top: 10, width: 400, height: 40 });
    fitTextToSafeArea(makeCanvas([obj]), 30);
    expect(obj.scaleX).toBe(1);
    expect(obj.scaleY).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[SafeArea] Text outside safe area vertically (no shrink):',
      expect.objectContaining({ edge: 'top' })
    );
  });

  it('does NOT shrink text that only violates the bottom edge', () => {
    // top=550, height=80 → bottom 630 > 570
    const obj = makeTextObj({ left: 100, top: 550, width: 400, height: 80 });
    fitTextToSafeArea(makeCanvas([obj]), 30);
    expect(obj.scaleX).toBe(1);
    expect(obj.scaleY).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[SafeArea] Text outside safe area vertically (no shrink):',
      expect.objectContaining({ edge: 'bottom' })
    );
  });

  it('keeps scale 1 for a line moved up by compaction into the first line slot (top < 30)', () => {
    // Regression: compaction moved text-2 into line 1's designed position
    const obj = makeTextObj({ left: 60, top: 12, width: 500, height: 36 });
    fitTextToSafeArea(makeCanvas([obj]), 30);
    expect(obj.scaleX).toBe(1);
    expect(obj.scaleY).toBe(1);
  });

  it('skips non-text objects and background rects', () => {
    const rect = makeTextObj(
      { left: 0, top: 0, width: 5000, height: 40 },
      { type: 'rect' }
    );
    const bgText = makeTextObj(
      { left: 0, top: 0, width: 5000, height: 40 },
      { isBackgroundRect: true }
    );
    fitTextToSafeArea(makeCanvas([rect, bgText]), 30);
    expect(rect.scaleX).toBe(1);
    expect(bgText.scaleX).toBe(1);
  });
});
