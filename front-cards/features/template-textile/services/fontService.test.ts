/**
 * @jest-environment jsdom
 */

import {
  fontService,
  normalizeFontVariant,
  variantFromTextStyle,
} from './fontService';
import type { TextElement } from '../types';

jest.mock('@/features/demo/isDemoMode', () => ({
  isDemoMode: () => true,
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
const { demoFontRepository } = require('@/features/demo/demoFontRepository');

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
});
