/**
 * Pass 3 demo-mode mapping analysis + explicit mapping override.
 * Mirrors the Normal-mode behaviors tested in api-server test_batch_parsing.py
 * (ExplicitMappingTests / InspectFileColumnsTests).
 */

import {
  analyzeHeaders,
  mapRowToContactFields,
  parseCsvText,
} from './demoSpreadsheetParser';

describe('analyzeHeaders', () => {
  it('reports per-column auto field, confidence and sample values', () => {
    const table = parseCsvText(
      'Nombre,Correo,Employee ID\nAna Gomez,ana@example.com,EMP-0042\nLuis Perez,luis@example.com,EMP-0043'
    );
    const analysis = analyzeHeaders(table);
    const byHeader = Object.fromEntries(analysis.map((c) => [c.sourceColumn, c]));

    expect(byHeader['Nombre']).toMatchObject({ autoField: 'first_name', confidence: 'alias' });
    expect(byHeader['Correo']).toMatchObject({ autoField: 'email', confidence: 'alias' });
    expect(byHeader['Employee ID']).toMatchObject({ autoField: null, confidence: 'none' });
    expect(byHeader['Employee ID'].sampleValues).toEqual(['EMP-0042', 'EMP-0043']);
  });

  it('flags fuzzy matches with fuzzy confidence', () => {
    const table = parseCsvText('Telefono Oficina 2\n22221111');
    const analysis = analyzeHeaders(table);
    expect(analysis[0]).toMatchObject({ autoField: 'work_phone', confidence: 'fuzzy' });
  });
});

describe('mapRowToContactFields with explicitMapping', () => {
  const headers = ['Nombre', 'Correo', 'Employee ID'];
  const cols = ['Ana Gomez', 'ana@example.com', 'EMP-0042'];

  it('explicit mapping beats the alias pass', () => {
    const fields = mapRowToContactFields(headers, cols, {
      explicitMapping: [{ sourceColumn: 'Correo', targetField: 'business_name' }],
    });
    expect(fields.businessName).toBe('ana@example.com');
    expect(fields.email).toBeUndefined();
  });

  it('ignore claims the column without mapping it (no positional re-add)', () => {
    const fields = mapRowToContactFields(headers, cols, {
      explicitMapping: [
        { sourceColumn: 'Nombre', targetField: 'ignore' },
        { sourceColumn: 'Correo', targetField: 'email' },
        { sourceColumn: 'Employee ID', targetField: 'ignore' },
      ],
    });
    expect(fields.email).toBe('ana@example.com');
    // Ignored name column must not resurface via the positional fallback.
    expect(fields.fullName).toBeUndefined();
    expect(fields.firstName).toBeUndefined();
  });

  it('columns not covered by the mapping fall through to auto-mapping', () => {
    const fields = mapRowToContactFields(
      ['Correo', 'Telefono Oficina 2'],
      ['ana@example.com', '22221111'],
      { explicitMapping: [{ sourceColumn: 'Correo', targetField: 'email' }] }
    );
    expect(fields.email).toBe('ana@example.com');
    expect(fields.workPhone).toBe('22221111'); // fuzzy fallback still applies
  });

  it('source columns match case/accent/separator-insensitively', () => {
    const fields = mapRowToContactFields(['E Mail'], ['ana@example.com'], {
      explicitMapping: [{ sourceColumn: 'e_mail', targetField: 'email' }],
    });
    expect(fields.email).toBe('ana@example.com');
  });
});
