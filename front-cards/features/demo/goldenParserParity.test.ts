import { readFileSync } from 'fs';
import path from 'path';
import {
  isUsefulDemoContactRow,
  mapRowToContactFields,
  parseCsvText,
} from './demoSpreadsheetParser';

const GOLDEN_CSV = `Nombre,Email,Teléfono,Ext
Sofía Rodríguez Oviedo,sofia@example.com,+52 55 1234 5678,101
Ada Lovelace,ada@example.com,+1 555 0100,
`;

const expected = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/golden_expected.json'), 'utf-8')
) as {
  headers: string[];
  rows: Array<{
    full_name: string;
    email: string;
    work_phone: string;
    work_phone_ext: string | null;
  }>;
};

describe('demoSpreadsheetParser golden fixture parity', () => {
  it('matches Python golden headers and mapped fields', () => {
    const table = parseCsvText(GOLDEN_CSV);
    expect(table.headers).toEqual(expected.headers);

    const dataRows = table.rows.filter((cols) => isUsefulDemoContactRow(table.headers, cols));
    expect(dataRows).toHaveLength(expected.rows.length);

    dataRows.forEach((cols, i) => {
      const fields = mapRowToContactFields(table.headers, cols);
      const spec = expected.rows[i];
      expect(fields.fullName).toBe(spec.full_name);
      expect(fields.email).toBe(spec.email);
      expect(fields.workPhone).toBe(spec.work_phone);
      expect(fields.workPhoneExt ?? null).toBe(spec.work_phone_ext);
    });
  });
});
