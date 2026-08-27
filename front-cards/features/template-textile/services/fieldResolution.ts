/**
 * Field resolution — render-time binding from a template element's `fieldId`
 * to a batch record property.
 *
 * The binding contract: a text element displays the record field whose
 * canonical id matches the element's `fieldId`. Resolution is tolerant, in
 * order: exact canonical id → normalized (case/accents/punctuation) →
 * `_N` duplicate-suffix strip → ingest alias table (same single source the
 * parsers use). Anything still unresolved returns null so callers can report
 * it instead of silently dropping data.
 */

import fieldAliasesSnapshot from '@/features/demo/fixtures/field-aliases.snapshot.json';

/**
 * Canonical fieldId (snake_case, template) -> record property (camelCase).
 * Keys must match `vcardFields` ids; values must match BatchRecord properties.
 */
export const FIELD_ID_TO_PROPERTY_MAP: Record<string, string> = {
  // Core fields
  'full_name': 'fullName',
  'first_name': 'firstName',
  'last_name': 'lastName',

  // Contact
  'work_phone': 'workPhone',
  'work_phone_ext': 'workPhoneExt',
  'mobile_phone': 'mobilePhone',
  'email': 'email',

  // Address
  'address_street': 'addressStreet',
  'address_city': 'addressCity',
  'address_state': 'addressState',
  'address_postal': 'addressPostal',
  'address_country': 'addressCountry',

  // Social
  'social_instagram': 'socialInstagram',
  'social_twitter': 'socialTwitter',
  'social_facebook': 'socialFacebook',

  // Business
  'business_name': 'businessName',
  'business_title': 'businessTitle',
  'business_department': 'businessDepartment',
  'business_url': 'businessUrl',
  'business_hours': 'businessHours',

  // Business Address
  'business_address_street': 'businessAddressStreet',
  'business_address_city': 'businessAddressCity',
  'business_address_state': 'businessAddressState',
  'business_address_postal': 'businessAddressPostal',
  'business_address_country': 'businessAddressCountry',

  // Professional
  'business_linkedin': 'businessLinkedin',
  'business_twitter': 'businessTwitter',

  // Personal
  'personal_url': 'personalUrl',
  'personal_bio': 'personalBio',
  'personal_birthday': 'personalBirthday',
};

/** Same normalization the ingest parsers apply to headers: trim, lowercase,
 *  strip accents, any non-alphanumeric run becomes `_`. */
export function normalizeFieldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Normalized alias -> canonical fieldId. Built from the shared alias snapshot
 *  (packages/shared-types/src/domain/field-aliases.json, duplicated to
 *  features/demo/fixtures/ per repo convention); canonical ids always resolve. */
const ALIAS_TO_FIELD_ID: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [fieldId, buckets] of Object.entries(fieldAliasesSnapshot.fields)) {
    map[normalizeFieldKey(fieldId)] = fieldId;
    for (const aliases of Object.values(buckets)) {
      for (const alias of aliases) {
        const key = normalizeFieldKey(alias);
        if (!(key in map)) map[key] = fieldId;
      }
    }
  }
  return map;
})();

/**
 * Resolve an element's fieldId to a record property name, or null when the
 * fieldId cannot correspond to any known record field.
 */
export function resolveRecordProperty(fieldId: string): string | null {
  // 1. Exact canonical id
  const direct = FIELD_ID_TO_PROPERTY_MAP[fieldId];
  if (direct) return direct;

  // 2. Normalized (case/accents/punctuation variants: "Mobile Phone", "Móvil")
  const normalized = normalizeFieldKey(fieldId);
  const viaNormalized = FIELD_ID_TO_PROPERTY_MAP[normalized];
  if (viaNormalized) return viaNormalized;

  // 3. Duplicate suffix ("work_phone_1") resolves the base field id — the
  //    designer never suffixes, but hand-edited/imported template JSON can.
  const base = normalized.replace(/_\d+$/, '');
  if (base !== normalized && FIELD_ID_TO_PROPERTY_MAP[base]) {
    return FIELD_ID_TO_PROPERTY_MAP[base];
  }

  // 4. Ingest alias table ("celular", "portable", "mobile", ...)
  const canonical = ALIAS_TO_FIELD_ID[normalized];
  if (canonical) return FIELD_ID_TO_PROPERTY_MAP[canonical] ?? null;

  return null;
}

/** Canonical fieldId this input resolves to (for UI validation), else null. */
export function resolveCanonicalFieldId(fieldId: string): string | null {
  const property = resolveRecordProperty(fieldId);
  if (!property) return null;
  const entry = Object.entries(FIELD_ID_TO_PROPERTY_MAP).find(([, prop]) => prop === property);
  return entry ? entry[0] : null;
}

/**
 * Read the record value for a fieldId. Returns null when the fieldId does not
 * resolve or the record value is null/blank. Final fallback: a record property
 * literally named like the raw fieldId (legacy hand-authored JSON) — keeps
 * pre-existing templates working.
 */
export function getRecordFieldValue(
  record: object,
  fieldId: string
): string | null {
  const rec = record as Record<string, unknown>;
  const property = resolveRecordProperty(fieldId) ?? (fieldId in rec ? fieldId : null);
  if (!property) return null;
  const value = rec[property];
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}
