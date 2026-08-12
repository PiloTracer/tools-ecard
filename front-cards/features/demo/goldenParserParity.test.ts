import { readFileSync } from 'fs';
import path from 'path';
import {
  isUsefulDemoContactRow,
  mapRowToContactFields,
  parseCsvText,
  parseDemoSpreadsheetFile,
} from './demoSpreadsheetParser';
import { buildXlsxFile } from './xlsxTestHelper';

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

function expectRowsMatchGolden(headers: string[], rows: string[][]) {
  const dataRows = rows.filter((cols) => isUsefulDemoContactRow(headers, cols));
  expect(dataRows).toHaveLength(expected.rows.length);

  dataRows.forEach((cols, i) => {
    const fields = mapRowToContactFields(headers, cols);
    const spec = expected.rows[i];
    expect(fields.fullName).toBe(spec.full_name);
    expect(fields.email).toBe(spec.email);
    expect(fields.workPhone).toBe(spec.work_phone);
    expect(fields.workPhoneExt ?? null).toBe(spec.work_phone_ext);
  });
}

describe('demoSpreadsheetParser golden fixture parity', () => {
  it('matches Python golden headers and mapped fields', () => {
    const table = parseCsvText(GOLDEN_CSV);
    expect(table.headers).toEqual(expected.headers);
    expectRowsMatchGolden(table.headers, table.rows);
  });

  it('matches Python golden on a transposed (headers in column A) .xlsx', () => {
    return (async () => {
      // Same contacts as GOLDEN_CSV, laid out vertically: headers down column
      // A, one contact per column B/C. Ada's blank Ext arrives as a
      // self-closing styled cell (the 2026-07-16 regression shape).
      const goldenRows = [
        ['Nombre', 'Sofía Rodríguez Oviedo', 'Ada Lovelace'],
        ['Email', 'sofia@example.com', 'ada@example.com'],
        ['Teléfono', '+52 55 1234 5678', '+1 555 0100'],
        ['Ext', '101', ''],
      ];
      const file = await buildXlsxFile(goldenRows, 'golden-transposed.xlsx');
      const table = await parseDemoSpreadsheetFile(file);
      expect(table.headers).toEqual(expected.headers);
      expectRowsMatchGolden(table.headers, table.rows);
    })();
  });
});
