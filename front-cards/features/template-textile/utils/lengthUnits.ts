/**
 * Web/CSS pixel mapping for physical units (per CSS Values spec: 1in = 96px).
 * Used for canvas and export "logical" size display; all Fabric/export math stays in pixels.
 */

export type LengthUnit = 'px' | 'cm' | 'in';

const PX_PER_INCH = 96;
const CM_PER_INCH = 2.54;

export function pixelsToInches(px: number): number {
  return px / PX_PER_INCH;
}

export function inchesToPixels(inches: number): number {
  return Math.round(inches * PX_PER_INCH);
}

export function pixelsToCm(px: number): number {
  return (px * CM_PER_INCH) / PX_PER_INCH;
}

export function cmToPixels(cm: number): number {
  return Math.round((cm * PX_PER_INCH) / CM_PER_INCH);
}

export function toPixels(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  switch (unit) {
    case 'px':
      return Math.round(value);
    case 'in':
      return inchesToPixels(value);
    case 'cm':
      return cmToPixels(value);
    default:
      return Math.round(value);
  }
}

export function fromPixels(pixels: number, unit: LengthUnit): number {
  if (!Number.isFinite(pixels) || pixels <= 0) return 0;
  switch (unit) {
    case 'px':
      return Math.round(pixels);
    case 'in':
      return roundTo(pixels / PX_PER_INCH, 3);
    case 'cm':
      return roundTo((pixels * CM_PER_INCH) / PX_PER_INCH, 2);
    default:
      return Math.round(pixels);
  }
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function unitLabel(unit: LengthUnit): string {
  switch (unit) {
    case 'px':
      return 'px';
    case 'cm':
      return 'cm';
    case 'in':
      return 'in';
  }
}

export const LENGTH_UNIT_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'px', label: 'px' },
  { value: 'cm', label: 'cm' },
  { value: 'in', label: 'in' },
];
