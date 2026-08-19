/**
 * Parity + variation guard for the per-language header alias table.
 *
 * Single source of truth: packages/shared-types/src/domain/field-aliases.json,
 * duplicated to fixtures/ per repo convention (the dev container mounts only
 * front-cards/). The Demo parser builds HEADER_ALIASES from it; the Python parser
 * builds FIELD_MAPPING from its own copy, asserted in
 * api-server/batch-parsing/test_batch_parsing.py (FieldAliasTableTests).
 */

import { readFileSync } from 'fs';
import path from 'path';
import { TextDecoder as NodeTextDecoder } from 'util';
import {
  analyzeHeaders,
  parseDemoSpreadsheetFile,
  mapRowToContactFields,
} from './demoSpreadsheetParser';

// This repo's jsdom predates a global TextDecoder; browsers always provide it.
(global as unknown as { TextDecoder?: unknown }).TextDecoder ??= NodeTextDecoder;

const aliasesTable = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/field-aliases.snapshot.json'), 'utf-8')
) as { fields: Record<string, Record<string, string[]>> };

const vcardSnapshot = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/vcard-fields.snapshot.json'), 'utf-8')
) as Array<{ id: string }>;

const BRAND_FIELDS = new Set([
  'social_instagram',
  'social_twitter',
  'social_facebook',
  'business_linkedin',
  'business_twitter',
]);

const analyzeOne = (header: string) =>
  analyzeHeaders({ headers: [header], rows: [['sample value']] })[0];

describe('field-aliases table parity', () => {
  it('alias fixture fields match the canonical vCard snapshot', () => {
    expect(Object.keys(aliasesTable.fields).sort()).toEqual(
      vcardSnapshot.map((f) => f.id).sort()
    );
  });

  it('language buckets are complete (en/es/fr, brand fields exempt from es/fr)', () => {
    for (const [field, buckets] of Object.entries(aliasesTable.fields)) {
      expect(buckets.en?.length ?? 0).toBeGreaterThan(0);
      if (BRAND_FIELDS.has(field)) continue;
      expect(buckets.es?.length ?? 0).toBeGreaterThan(0);
      expect(buckets.fr?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('HEADER_ALIASES resolves every fixture alias to its field', () => {
    for (const [field, buckets] of Object.entries(aliasesTable.fields)) {
      for (const header of [field, ...Object.values(buckets).flat()]) {
        const analysis = analyzeOne(header);
        expect({ header, got: analysis.autoField }).toEqual({ header, got: field });
      }
    }
  });
});

describe('EN/ES/FR header variations', () => {
  const VARIATIONS: Record<string, string[]> = {
    full_name: ['Full Name', 'Nombre Completo', 'Nom Complet', 'nom complet'],
    first_name: ['First Name', 'Nombre', 'Prénom', 'PRENOM'],
    last_name: ['Last Name', 'Apellidos', 'Nom de famille', 'Nom'],
    work_phone: ['work phone', 'Telefono Trabajo', 'TELÉFONO OFICINA', 'Téléphone Bureau', 'tel'],
    work_phone_ext: ['Ext', 'Extensión', 'Extension Trabajo', 'Poste Téléphonique'],
    mobile_phone: ['mobile', 'Celular', 'WhatsApp', 'Portable', 'Téléphone Portable'],
    email: ['Email', 'Correo', 'Correo Electrónico', 'Courriel', 'e-mail'],
    address_street: ['Street Address', 'Dirección', 'Adresse', 'Rue'],
    address_city: ['City', 'Ciudad', 'Ville'],
    address_state: ['State', 'Provincia', 'Région', 'État'],
    address_postal: ['Zip Code', 'Código Postal', 'Code Postal'],
    address_country: ['Country', 'País', 'Pays'],
    social_instagram: ['Instagram'],
    social_twitter: ['Twitter', 'X'],
    social_facebook: ['Facebook'],
    business_name: ['Company', 'Empresa', 'Entreprise', 'Société'],
    business_title: ['Job Title', 'Puesto', 'Cargo', 'Poste', 'Fonction'],
    business_department: ['Department', 'Área', 'Service', 'Département'],
    business_url: ['Website', 'Sitio Web', 'Site Web'],
    business_hours: ['Business Hours', 'Horario', 'Horaires'],
    business_address_street: ['Business Address', 'Dirección Trabajo', 'Adresse Professionnelle'],
    business_address_city: ['Business City', 'Ciudad Trabajo', 'Ville Travail'],
    business_address_state: ['Business State', 'Estado Trabajo', 'Province Travail'],
    business_address_postal: ['Business Zip', 'Postal Trabajo', 'Code Postal Travail'],
    business_address_country: ['Business Country', 'País Trabajo', 'Pays Travail'],
    business_linkedin: ['LinkedIn'],
    business_twitter: ['Company Twitter'],
    personal_url: ['Personal Website', 'Sitio Personal', 'Site Personnel'],
    personal_bio: ['Notes', 'Notas', 'Biographie'],
    personal_birthday: ['Birthday', 'Cumpleaños', 'Date de Naissance', 'Anniversaire'],
  };

  it('every variation resolves to its canonical field', () => {
    for (const [field, headers] of Object.entries(VARIATIONS)) {
      for (const header of headers) {
        const analysis = analyzeOne(header);
        expect({ header, got: analysis.autoField }).toEqual({ header, got: field });
      }
    }
  });

  it('fuzzy variations with filler words resolve (strong-token priority)', () => {
    expect(analyzeOne('Téléphone de Bureau 2').autoField).toBe('work_phone');
    expect(analyzeOne('Numéro de Portable 2').autoField).toBe('mobile_phone');
    expect(analyzeOne('Courriel Professionnel').autoField).toBe('email');
    expect(analyzeOne('Teléfono Oficina 2').autoField).toBe('work_phone');
    expect(analyzeOne('Correo Trabajo').autoField).toBe('email');
  });
});

describe('French paste end-to-end (Demo parser)', () => {
  it('parses a French KV paste into all mapped fields', async () => {
    const text = [
      'Nom Complet: Jeanne Dupont',
      'Courriel: jeanne.dupont@exemple.fr',
      'Téléphone Bureau: +33 1 23 45 67 89',
      'Portable: +33 6 12 34 56 78',
      'Adresse: 12 Rue de Rivoli',
      'Ville: Paris',
      'Code Postal: 75001',
      'Pays: France',
      'Entreprise: Exemple SARL',
      'Poste: Directrice',
      'Date de Naissance: 1990-03-22',
    ].join('\n');
    const file = new File([text], 'pasted-content.txt', { type: 'text/plain' });

    const table = await parseDemoSpreadsheetFile(file);
    expect(table.rows.length).toBe(1);

    const fields = mapRowToContactFields(table.headers, table.rows[0], { workPhonePrefix: null });
    expect(fields.fullName).toBe('Jeanne Dupont');
    expect(fields.email).toBe('jeanne.dupont@exemple.fr');
    expect(fields.workPhone).toBe('+33 1 23 45 67 89');
    expect(fields.mobilePhone).toBe('+33 6 12 34 56 78');
    expect(fields.addressStreet).toBe('12 Rue de Rivoli');
    expect(fields.addressCity).toBe('Paris');
    expect(fields.addressPostal).toBe('75001');
    expect(fields.addressCountry).toBe('France');
    expect(fields.businessName).toBe('Exemple SARL');
    expect(fields.businessTitle).toBe('Directrice');
    expect(fields.personalBirthday).toBe('1990-03-22');
  });
});
