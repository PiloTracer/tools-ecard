/**
 * Decode XML / HTML character references in spreadsheet cell text.
 * Excel sharedStrings.xml often stores accented characters as numeric entities
 * (e.g. &#243; for ó) which must be decoded before display or PNG export.
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
