import { readFileSync } from 'fs';
import path from 'path';
import { TextDecoder as NodeTextDecoder } from 'util';

// This repo's jsdom predates a global TextDecoder; browsers always provide it.
(global as unknown as { TextDecoder?: unknown }).TextDecoder ??= NodeTextDecoder;

import {
  DemoContactFields,
  mapRowToContactFields,
  parseDemoSpreadsheetFile,
  parseVcf,
} from './demoSpreadsheetParser';

type VcfCase = {
  id: string;
  vcf: string;
  expected: Array<{
    fields?: Record<string, string>;
    absentFields?: string[];
    unmappedContains?: string[];
  }>;
};

// Shared contract with the Normal (python) parser — same file lives at
// api-server/batch-parsing/fixtures/vcf_samples.json. Expected fields use the
// canonical snake_case ids; the demo side converts them to camelCase.
const { cases } = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/vcf_samples.json'), 'utf-8')
) as { cases: VcfCase[] };

const snakeToCamel = (id: string): string =>
  id.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

describe('parseVcf — shared fixture parity with the Normal (python) parser', () => {
  for (const vcfCase of cases) {
    it(`maps case ${vcfCase.id}`, async () => {
      const file = new File([vcfCase.vcf], `${vcfCase.id}.vcf`, { type: 'text/vcard' });
      const table = await parseDemoSpreadsheetFile(file);
      expect(table.rows).toHaveLength(vcfCase.expected.length);

      const unmappedIdx = table.headers.indexOf('vcf_unmapped');
      table.rows.forEach((cols, i) => {
        const spec = vcfCase.expected[i];
        const fields = mapRowToContactFields(table.headers, cols);
        for (const [key, value] of Object.entries(spec.fields ?? {})) {
          expect(fields[snakeToCamel(key) as keyof DemoContactFields] ?? null).toBe(value);
        }
        for (const key of spec.absentFields ?? []) {
          expect(fields[snakeToCamel(key) as keyof DemoContactFields] ?? null).toBeNull();
        }
        const unmapped = unmappedIdx >= 0 ? cols[unmappedIdx] : '';
        for (const needle of spec.unmappedContains ?? []) {
          expect(unmapped).toContain(needle);
        }
      });
    });
  }

  it('exposes a vcf_unmapped column instead of dropping unknown properties', () => {
    const table = parseVcf(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Doe;Jane;;\r\nFN:Jane Doe\r\n' +
        'X-CUSTOM-ID:EMP-0001\r\nEND:VCARD\r\n'
    );
    expect(table.headers).toContain('vcf_unmapped');
    const idx = table.headers.indexOf('vcf_unmapped');
    expect(table.rows[0][idx]).toContain('X-CUSTOM-ID: EMP-0001');
  });

  it('returns an empty table for empty or card-less content', () => {
    expect(parseVcf('').rows).toHaveLength(0);
    expect(parseVcf('not a vcard at all\n').rows).toHaveLength(0);
    expect(parseVcf('BEGIN:VCARD\r\nEND:VCARD\r\n').rows).toHaveLength(0);
  });
});
