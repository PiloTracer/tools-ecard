/**
 * Decode XML / HTML character references in record field values.
 * Mirrors front-cards/shared/lib/decodeXmlEntities.ts for server-side rendering.
 */

function codePointToString(codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return '';
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return '';
  }
}

export function decodeXmlEntities(value: string): string {
  if (!value || !value.includes('&')) return value;

  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => codePointToString(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => codePointToString(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
