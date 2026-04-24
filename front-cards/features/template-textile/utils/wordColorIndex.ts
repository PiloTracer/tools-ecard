import type { WordColorMode } from '../types';

/**
 * Resolves which palette index applies to a word, given how many words and colors
 * the element has. Export for PropertyPanel preview and for Fabric multi-color text.
 */
export function wordIndexToColorIndex(
  wordIndex: number,
  wordCount: number,
  colorCount: number,
  mode: WordColorMode | undefined
): number {
  if (wordCount < 1 || colorCount < 1) return 0;
  if (wordIndex < 0) return 0;

  const useSequential = mode === 'sequential' || !mode;
  if (useSequential) {
    return Math.min(wordIndex, colorCount - 1);
  }

  // Proportional: split word indices 0..W-1 into C contiguous groups as evenly
  // as possible (e.g. W=3 C=2 -> sizes 1+2; W=4 C=2 -> 2+2).
  if (colorCount > wordCount) {
    return Math.min(wordIndex, colorCount - 1);
  }

  for (let k = 0; k < colorCount; k++) {
    const start = Math.floor((k * wordCount) / colorCount);
    const end = Math.floor(((k + 1) * wordCount) / colorCount);
    if (wordIndex >= start && wordIndex < end) {
      return k;
    }
  }
  return colorCount - 1;
}

/**
 * One-line label for a color row (which words use this color) for the inspector.
 */
export function colorSlotLabel(
  colorIndex: number,
  wordCount: number,
  colorCount: number,
  mode: WordColorMode | undefined
): string {
  if (colorCount < 1) return '—';
  if (wordCount === 0) return '—';

  const useSequential = mode === 'sequential' || !mode;
  if (useSequential) {
    if (colorIndex < colorCount - 1) {
      return `Word ${colorIndex + 1}`;
    }
    if (wordCount > colorIndex + 1) {
      return `Words ${colorIndex + 1}+`;
    }
    return `Word ${colorIndex + 1}`;
  }

  if (colorCount > wordCount) {
    return colorIndex < wordCount
      ? `Word ${colorIndex + 1}`
      : 'Unused (extra color)';
  }

  const start = Math.floor((colorIndex * wordCount) / colorCount);
  const end = Math.floor(((colorIndex + 1) * wordCount) / colorCount);
  const a = start + 1;
  const b = end; // 1-based inclusive: words start..end-1 -> a..b
  if (a === b) {
    return `Word ${a}`;
  }
  return `Words ${a}–${b}`;
}
