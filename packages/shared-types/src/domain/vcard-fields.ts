/**
 * Canonical vCard field list — the 30 contact fields supported across the stack.
 * Companion table: field-aliases.json — per-language (en/es/fr) header aliases for
 * these ids, consumed by both parsers (language buckets merged; add a language by
 * adding a bucket, no parser code changes).
 *
 * Single source of truth for:
 *   - Normal-mode Python parser: FIELD_MAPPING keys (api-server/batch-parsing/data_normalizer.py)
 *   - Front template toolbox: vcardFields.ts ids (front-cards/features/template-textile/utils)
 *   - Demo parser: DemoContactFields keys / HEADER_ALIASES targets (front-cards/features/demo)
 *
 * Parity is enforced by tests on both sides (fixtures are duplicated per repo
 * convention, see golden_expected.json):
 *   - api-server/batch-parsing/test_batch_parsing.py (FIELD_MAPPING ≡ snapshot,
 *     FieldAliasTableTests for the alias table)
 *   - front-cards/features/demo/vcardFieldsParity.test.ts (vcardFields + Demo ≡ snapshot)
 *   - front-cards/features/demo/fieldAliasesParity.test.ts (alias table + EN/ES/FR variations)
 */

export type VCardFieldCategory = 'core' | 'business' | 'personal';

export type CanonicalVCardField = {
  /** snake_case id — matches Python FIELD_MAPPING keys and vcardFields.ts ids */
  id: string;
  labelEn: string;
  labelEs: string;
  category: VCardFieldCategory;
};

export const canonicalVCardFields: CanonicalVCardField[] = [
  // Core Contact Fields (All Cards)
  { id: 'full_name', labelEn: 'Full name', labelEs: 'Nombre completo', category: 'core' },
  { id: 'first_name', labelEn: 'First name', labelEs: 'Nombre', category: 'core' },
  { id: 'last_name', labelEn: 'Last name', labelEs: 'Apellidos', category: 'core' },

  // Contact methods
  { id: 'work_phone', labelEn: 'Work phone', labelEs: 'Teléfono trabajo', category: 'core' },
  { id: 'work_phone_ext', labelEn: 'Work phone extension', labelEs: 'Extensión', category: 'core' },
  { id: 'mobile_phone', labelEn: 'Mobile phone', labelEs: 'Celular', category: 'core' },
  { id: 'email', labelEn: 'Email', labelEs: 'Correo electrónico', category: 'core' },

  // Address (structured)
  { id: 'address_street', labelEn: 'Street address', labelEs: 'Dirección', category: 'core' },
  { id: 'address_city', labelEn: 'City', labelEs: 'Ciudad', category: 'core' },
  { id: 'address_state', labelEn: 'State / Province', labelEs: 'Estado / Provincia', category: 'core' },
  { id: 'address_postal', labelEn: 'Postal code', labelEs: 'Código postal', category: 'core' },
  { id: 'address_country', labelEn: 'Country', labelEs: 'País', category: 'core' },

  // Social profiles
  { id: 'social_instagram', labelEn: 'Instagram', labelEs: 'Instagram', category: 'core' },
  { id: 'social_twitter', labelEn: 'Twitter / X', labelEs: 'Twitter / X', category: 'core' },
  { id: 'social_facebook', labelEn: 'Facebook', labelEs: 'Facebook', category: 'core' },

  // Business Fields (Business Cards)
  { id: 'business_name', labelEn: 'Company', labelEs: 'Empresa', category: 'business' },
  { id: 'business_title', labelEn: 'Job title', labelEs: 'Puesto', category: 'business' },
  { id: 'business_department', labelEn: 'Department', labelEs: 'Departamento', category: 'business' },
  { id: 'business_url', labelEn: 'Website', labelEs: 'Sitio web', category: 'business' },
  { id: 'business_hours', labelEn: 'Business hours', labelEs: 'Horario', category: 'business' },

  // Business address (optional override)
  { id: 'business_address_street', labelEn: 'Business street', labelEs: 'Dirección trabajo', category: 'business' },
  { id: 'business_address_city', labelEn: 'Business city', labelEs: 'Ciudad trabajo', category: 'business' },
  { id: 'business_address_state', labelEn: 'Business state', labelEs: 'Estado trabajo', category: 'business' },
  { id: 'business_address_postal', labelEn: 'Business postal code', labelEs: 'Código postal trabajo', category: 'business' },
  { id: 'business_address_country', labelEn: 'Business country', labelEs: 'País trabajo', category: 'business' },

  // Professional profiles
  { id: 'business_linkedin', labelEn: 'LinkedIn', labelEs: 'LinkedIn', category: 'business' },
  { id: 'business_twitter', labelEn: 'Company Twitter', labelEs: 'Twitter empresa', category: 'business' },

  // Personal Fields (Personal Cards)
  { id: 'personal_url', labelEn: 'Personal website', labelEs: 'Sitio personal', category: 'personal' },
  { id: 'personal_bio', labelEn: 'Bio', labelEs: 'Biografía', category: 'personal' },
  { id: 'personal_birthday', labelEn: 'Birthday', labelEs: 'Cumpleaños', category: 'personal' },
];
