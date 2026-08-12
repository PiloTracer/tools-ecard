/**
 * Demo batch repository round-trips (Passes 2-3): a .vcf upload becomes one
 * record per card through the TS service layer, and an explicit field mapping
 * threaded into uploadBatch shapes the stored records.
 */

import { TextDecoder as NodeTextDecoder } from 'util';

import { demoBatchRepository } from './demoBatchRepository';
import { demoStore } from './demoStore';
import { resolveDemoStorageUserId } from './demoStorageUserId';
import { MAPPING_IGNORE_TARGET, type FieldMappingEntry } from '@/features/batch-upload/types';

// This repo's jsdom predates a global TextDecoder; browsers always provide it.
(global as unknown as { TextDecoder?: unknown }).TextDecoder ??= NodeTextDecoder;

const PROJECT_ID = 'project-1';
const PROJECT_NAME = 'Demo Project';

interface DemoStoredRecord {
  id: string;
  batchId: string;
  data: {
    headers: string[];
    cols: string[];
    fields: Record<string, string | null>;
  };
}

describe('demoBatchRepository round-trips', () => {
  beforeEach(() => {
    localStorage.clear();
    demoStore.setActiveUserId(
      resolveDemoStorageUserId({ id: 'batch-user', email: 'batch@example.com' })
    );
  });

  it('stores one record per card for a multi-card .vcf upload', async () => {
    const file = new File(
      [
        'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Doe;Jane;;\r\nFN:Jane Doe\r\n' +
          'EMAIL:jane.doe@example.com\r\nTEL;TYPE=CELL:+506 8888 0000\r\nEND:VCARD\r\n' +
          'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Smith;John;;\r\nFN:John Smith\r\n' +
          'EMAIL:john.smith@example.com\r\nEND:VCARD\r\n',
      ],
      'contacts.vcf',
      { type: 'text/vcard' }
    );

    const result = await demoBatchRepository.uploadBatch(file, PROJECT_ID, PROJECT_NAME);
    const records = demoBatchRepository.getRecords(result.id) as unknown as DemoStoredRecord[];

    expect(records).toHaveLength(2);
    expect(records[0].data.fields.fullName).toBe('Jane Doe');
    expect(records[0].data.fields.email).toBe('jane.doe@example.com');
    expect(records[0].data.fields.mobilePhone).toBe('+506 8888 0000');
    expect(records[1].data.fields.fullName).toBe('John Smith');

    const status = await demoBatchRepository.getBatchStatus(result.id);
    expect(status.recordsCount).toBe(2);
  });

  it('applies an explicit mapping (and ignore) to uploaded records', async () => {
    const file = new File(
      ['Codigo,Correo\nEMP-0042,ana@example.com\n'],
      'staff.csv',
      { type: 'text/csv' }
    );
    const mapping: FieldMappingEntry[] = [
      { sourceColumn: 'Codigo', targetField: 'business_name' },
      { sourceColumn: 'Correo', targetField: MAPPING_IGNORE_TARGET },
    ];

    const result = await demoBatchRepository.uploadBatch(file, PROJECT_ID, PROJECT_NAME, mapping);
    const records = demoBatchRepository.getRecords(result.id) as unknown as DemoStoredRecord[];

    expect(records).toHaveLength(1);
    // Explicit claim beats the unknown header; the ignored alias column is not mapped.
    // (business_name preserves value casing — person-name fields would capitalize.)
    expect(records[0].data.fields.businessName).toBe('EMP-0042');
    expect(records[0].data.fields.email).toBeFalsy();
    // Raw columns are kept on the record (nothing silently dropped).
    expect(records[0].data.headers).toEqual(['Codigo', 'Correo']);
  });
});
