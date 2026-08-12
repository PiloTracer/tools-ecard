import { describe, it, expect } from '@jest/globals';
import {
  normalizeHeaderKey,
  computeMappingSignature,
  validateFieldMappings,
  getCanonicalTargetFields,
  toPythonMappingPayload,
  FieldMappingValidationError,
  IGNORE_TARGET,
} from '../../../src/features/batch-import/services/fieldMapping';

describe('fieldMapping helpers', () => {
  describe('normalizeHeaderKey', () => {
    it('ignores case, accents and separators', () => {
      expect(normalizeHeaderKey('Business Address Street')).toBe('business_address_street');
      expect(normalizeHeaderKey('BUSINESS_ADDRESS_STREET')).toBe('business_address_street');
      expect(normalizeHeaderKey('Teléfono Ofi.')).toBe('telefono_ofi');
    });
  });

  describe('computeMappingSignature', () => {
    it('is stable regardless of header order and casing', () => {
      const a = computeMappingSignature(['Nombre', 'Correo', 'Employee ID']);
      const b = computeMappingSignature(['employee id', 'CORREO', 'nombre']);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{8}$/);
    });

    it('differs for different header sets', () => {
      expect(computeMappingSignature(['a', 'b'])).not.toBe(computeMappingSignature(['a', 'c']));
    });
  });

  describe('getCanonicalTargetFields', () => {
    it('loads the 30-field snapshot with labels', () => {
      const fields = getCanonicalTargetFields();
      expect(fields).toHaveLength(30);
      const email = fields.find((f) => f.id === 'email');
      expect(email?.labelEn).toBeTruthy();
      expect(email?.labelEs).toBeTruthy();
    });
  });

  describe('validateFieldMappings', () => {
    it('accepts canonical targets and ignore', () => {
      const mappings = validateFieldMappings([
        { sourceColumn: 'E Mail', targetField: 'email' },
        { sourceColumn: 'Legacy', targetField: IGNORE_TARGET },
      ]);
      expect(mappings).toHaveLength(2);
    });

    it('rejects unknown target fields listing valid ids', () => {
      expect(() =>
        validateFieldMappings([{ sourceColumn: 'Correo', targetField: 'emial' }])
      ).toThrow(FieldMappingValidationError);
      try {
        validateFieldMappings([{ sourceColumn: 'Correo', targetField: 'emial' }]);
      } catch (error) {
        expect((error as Error).message).toContain('email');
        expect((error as Error).message).toContain('ignore');
      }
    });

    it('rejects malformed payloads', () => {
      expect(() => validateFieldMappings('nope')).toThrow(FieldMappingValidationError);
      expect(() => validateFieldMappings([{ sourceColumn: '', targetField: 'email' }])).toThrow(
        FieldMappingValidationError
      );
    });
  });

  describe('toPythonMappingPayload', () => {
    it('emits the snake_case shape the parser expects', () => {
      const payload = JSON.parse(
        toPythonMappingPayload([{ sourceColumn: 'E Mail', targetField: 'email' }])
      );
      expect(payload).toEqual({
        mappings: [{ source_column: 'E Mail', target_field: 'email' }],
      });
    });
  });
});
