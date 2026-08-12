import {
  normalizeHeaderKey,
  computeMappingSignature,
  snakeToCamel,
  camelToSnake,
} from './mappingSignature';

describe('mappingSignature utils (Pass 3)', () => {
  it('normalizeHeaderKey ignores case, accents and separators', () => {
    expect(normalizeHeaderKey('Business Address Street')).toBe('business_address_street');
    expect(normalizeHeaderKey('BUSINESS_ADDRESS_STREET')).toBe('business_address_street');
    expect(normalizeHeaderKey('Teléfono Ofi.')).toBe('telefono_ofi');
  });

  it('signature is stable regardless of header order and casing', () => {
    const a = computeMappingSignature(['Nombre', 'Correo', 'Employee ID']);
    const b = computeMappingSignature(['employee id', 'CORREO', 'nombre']);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('signature differs for different header sets', () => {
    expect(computeMappingSignature(['a', 'b'])).not.toBe(computeMappingSignature(['a', 'c']));
  });

  it('snake/camel conversion round-trips the canonical ids', () => {
    expect(snakeToCamel('business_linkedin')).toBe('businessLinkedin');
    expect(snakeToCamel('work_phone_ext')).toBe('workPhoneExt');
    expect(camelToSnake('workPhoneExt')).toBe('work_phone_ext');
  });
});
