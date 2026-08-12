/**
 * Field-mapping helpers (Pass 3): header normalization + preset signature.
 * Mirrors api-server src/features/batch-import/services/fieldMapping.ts exactly —
 * a preset saved in one mode would match the same headers in the other.
 */

/** Lowercase, accent-stripped, every non-alphanumeric run collapsed to `_`. */
export function normalizeHeaderKey(raw: string): string {
  return String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** snake_case canonical id → camelCase DemoContactFields key. */
export function snakeToCamel(id: string): string {
  return id.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** camelCase DemoContactFields key → snake_case canonical id. */
export function camelToSnake(id: string): string {
  return id.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Stable hash of the sorted normalized header list (FNV-1a 32-bit). Used to
 * auto-suggest a saved preset when the same columns are seen again.
 */
export function computeMappingSignature(headers: string[]): string {
  const input = headers.map(normalizeHeaderKey).filter(Boolean).sort().join('\n');
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
