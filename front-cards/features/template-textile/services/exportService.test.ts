/**
 * @jest-environment jsdom
 */

import { preloadTemplateFonts } from './exportService';
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
