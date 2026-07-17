/** Words that should remain lowercase in a name (Spanish/English particles). */
const NAME_PARTICLES = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'o', 'a', 'en',
  'al', 'por', 'para', 'con', 'sin', 'un', 'una', 'el', 'da',
  'do', 'das', 'dos', 'di', 'van', 'von',
]);

/**
 * Snake_case field ids that receive person-name title casing at ingest.
 * Intentionally excludes business_name (Normal parser preserves brand casing).
 */
export const PERSON_NAME_FIELD_IDS = new Set([
  'full_name',
  'first_name',
  'last_name',
]);

/** DemoContactFields keys that receive person-name title casing at ingest. */
export const DEMO_PERSON_NAME_KEYS = new Set([
  'fullName',
  'firstName',
  'lastName',
]);

/**
 * Capitalize each word of a name string, preserving particles in lowercase
 * (e.g. "maría de los ángeles" → "María de los Ángeles").
 * Apply only at first ingest — never on export/render or later user edits.
 */
export function capitalizeName(name: string): string {
  if (!name) return name;
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return name;
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && NAME_PARTICLES.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Apply capitalizeName when fieldId is a person-name field (snake_case). */
export function capitalizeIfNameField(fieldId: string | undefined, value: string): string {
  if (!fieldId || !PERSON_NAME_FIELD_IDS.has(fieldId)) return value;
  return capitalizeName(value);
}
