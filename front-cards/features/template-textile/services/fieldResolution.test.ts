/**
 * fieldResolution tests — render-time fieldId → record property binding.
 *
 * The binding contract: any reasonable spelling of a canonical field the user
 * puts in "Data field" must resolve; anything unknown must return null so the
 * caller can report it instead of silently dropping record data.
 */

import {
  FIELD_ID_TO_PROPERTY_MAP,
  resolveRecordProperty,
  resolveCanonicalFieldId,
  getRecordFieldValue,
  normalizeFieldKey,
} from './fieldResolution';
import { vcardFields } from '../utils/vcardFields';

describe('resolveRecordProperty', () => {
  it('resolves every canonical palette fieldId', () => {
    for (const field of vcardFields) {
      expect(resolveRecordProperty(field.id)).not.toBeNull();
    }
  });

  it('resolves exact canonical ids', () => {
    expect(resolveRecordProperty('mobile_phone')).toBe('mobilePhone');
    expect(resolveRecordProperty('full_name')).toBe('fullName');
  });

  it('resolves case/punctuation variants', () => {
    expect(resolveRecordProperty('Mobile Phone')).toBe('mobilePhone');
    expect(resolveRecordProperty('MOBILE-PHONE')).toBe('mobilePhone');
  });

  it('resolves numeric-suffixed duplicates to the base field', () => {
    expect(resolveRecordProperty('work_phone_1')).toBe('workPhone');
    expect(resolveRecordProperty('work_phone_2')).toBe('workPhone');
  });

  it('does not mistake a real suffixed field for a duplicate', () => {
    expect(resolveRecordProperty('work_phone_ext')).toBe('workPhoneExt');
  });

  it('resolves ingest aliases in any language bucket', () => {
    expect(resolveRecordProperty('celular')).toBe('mobilePhone'); // es
    expect(resolveRecordProperty('portable')).toBe('mobilePhone'); // fr
    expect(resolveRecordProperty('correo')).toBe('email'); // es
    expect(resolveRecordProperty('cell phone')).toBe('mobilePhone'); // en
  });

  it('returns null for unknown fieldIds (no silent passthrough guessing)', () => {
    expect(resolveRecordProperty('favorite_color')).toBeNull();
    expect(resolveRecordProperty('text_1')).toBeNull();
    expect(resolveRecordProperty('')).toBeNull();
  });
});

describe('resolveCanonicalFieldId', () => {
  it('returns the canonical id for aliases and variants', () => {
    expect(resolveCanonicalFieldId('Mobile Phone')).toBe('mobile_phone');
    expect(resolveCanonicalFieldId('celular')).toBe('mobile_phone');
    expect(resolveCanonicalFieldId('work_phone_1')).toBe('work_phone');
  });

  it('returns null for unknown fieldIds', () => {
    expect(resolveCanonicalFieldId('favorite_color')).toBeNull();
  });
});

describe('getRecordFieldValue', () => {
  const record = {
    mobilePhone: '+1 555 000 1111',
    fullName: '  ',
    email: null,
    legacyCustom: 'legacy-value',
  } as Record<string, unknown>;

  it('reads the mapped record property', () => {
    expect(getRecordFieldValue(record, 'mobile_phone')).toBe('+1 555 000 1111');
  });

  it('treats null and blank values as missing', () => {
    expect(getRecordFieldValue(record, 'email')).toBeNull();
    expect(getRecordFieldValue(record, 'full_name')).toBeNull();
  });

  it('keeps the legacy passthrough for record properties named like the raw fieldId', () => {
    expect(getRecordFieldValue(record, 'legacyCustom')).toBe('legacy-value');
  });

  it('returns null for unresolvable fieldIds absent from the record', () => {
    expect(getRecordFieldValue(record, 'favorite_color')).toBeNull();
  });
});

describe('normalizeFieldKey', () => {
  it('matches the ingest parser normalization', () => {
    expect(normalizeFieldKey('  Teléfono Oficina ')).toBe('telefono_oficina');
    expect(normalizeFieldKey('Mobile-Phone')).toBe('mobile_phone');
  });
});

describe('map inventory', () => {
  it('covers exactly the canonical palette field ids', () => {
    expect(Object.keys(FIELD_ID_TO_PROPERTY_MAP).sort()).toEqual(
      vcardFields.map((f) => f.id).sort()
    );
  });
});
