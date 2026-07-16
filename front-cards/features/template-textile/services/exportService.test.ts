/**
 * @jest-environment jsdom
 */

import { preloadTemplateFonts } from './exportService';
import type { TextElement } from '../types';

jest.mock('./fontService', () => ({
  fontService: {
    getCachedFonts: jest.fn(),
    listFonts: jest.fn(),
    loadFont: jest.fn(),
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
    fontService.getCachedFonts.mockReturnValue([
      {
        fontId: 'f1',
        userId: null,
        fontName: 'Custom Sans',
        fontFamily: 'Custom Sans',
        fontCategory: 'sans-serif',
        fontVariant: 'regular',
        fontWeight: 400,
        fontStyle: 'normal',
        isSystemFont: false,
      },
    ]);
  });

  it('does nothing when there are no text elements', async () => {
    await preloadTemplateFonts([]);
    expect(fontService.loadFont).not.toHaveBeenCalled();
  });

  it('loads the font matching a text element fontFamily + variant', async () => {
    await preloadTemplateFonts([textEl()]);
    expect(fontService.loadFont).toHaveBeenCalledTimes(1);
    expect(fontService.loadFont).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: 'Custom Sans', fontVariant: 'regular' })
    );
  });

  it('fetches the catalog when the cache is empty', async () => {
    fontService.getCachedFonts.mockReturnValueOnce([]).mockReturnValue([
      {
        fontId: 'f1',
        fontFamily: 'Custom Sans',
        fontVariant: 'regular',
        fontWeight: 400,
        fontStyle: 'normal',
      },
    ]);
    await preloadTemplateFonts([textEl()]);
    expect(fontService.listFonts).toHaveBeenCalledWith('all');
  });

  it('does not throw when the referenced font is not in the catalog (falls back gracefully)', async () => {
    fontService.getCachedFonts.mockReturnValue([]);
    await expect(preloadTemplateFonts([textEl({ fontFamily: 'Unknown Font' })])).resolves.toBeUndefined();
    expect(fontService.loadFont).not.toHaveBeenCalled();
  });

  it('resolves a bold variant to any matching family when the exact variant is missing', async () => {
    await preloadTemplateFonts([textEl({ fontWeight: 'bold' })]);
    // No exact bold variant cached — falls back to the regular entry for the same family
    expect(fontService.loadFont).toHaveBeenCalledWith(
      expect.objectContaining({ fontFamily: 'Custom Sans' })
    );
  });
});
