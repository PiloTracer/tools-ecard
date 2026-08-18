/**
 * @jest-environment jsdom
 *
 * End-to-end demo-mode flow: upload a key-value text batch, fetch the stored
 * records, and verify every field (including work_phone) is available to the
 * batch export path.
 */

import { TextDecoder } from 'util';
(globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;

import { demoBatchRepository } from './demoBatchRepository';
import { batchRecordService } from '@/features/batch-records/services/batchRecordService';
import { applyRecordData } from '@/features/template-textile/services/batchExportService';
import type { BatchRecord } from '@/features/template-textile/services/batchExportService';
import { demoStore } from './demoStore';
import type { Template, TextElement } from '@/features/template-textile/types';

const TEST_TEXT = `full_name:\tJohn Doe XXX
work_phone:\t+506 2222-1234
work_phone_ext:\t123
mobile_phone:\t+506 8888-9999
email:\tjohn.doe@eco.com
address_street:\t123 Main Street
address_city:\tSan José
address_state:\tSJ
address_postal:\t10101
address_country:\tCosta Rica
social_instagram:\t@johndoeX
social_twitter:\t@johndoe_official
social_facebook:\tjohndoe.profile
business_name:\tEco Corporation
business_title:\tSenior ext
business_department:\tEngineering
business_url:\thttps://eco.com
business_hours:\tMon-Fri 9AM-5PM
business_address_street:\t456 Business Ave
business_address_city:\tSan Francisco
business_address_state:\tCA
business_address_postal:\t94107
business_address_country:\tUSA
business_linkedin:\tlinkedin.com/in/johndoe
business_twitter:\t@acme_official
personal_url:\thttps://johndoe.com
personal_bio:\tSoftware engineer and photography enthusiast
personal_birthday:\t2000-05-15`;

function makeTemplate(fieldIds: string[]): Template {
  return {
    id: 'tpl-1',
    name: 'test',
    width: 1200,
    height: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
    elements: fieldIds.map(
      (fieldId, i) =>
        ({
          id: `el-${i}`,
          type: 'text',
          x: 10,
          y: 10 + i * 30,
          text: 'placeholder',
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#000000',
          textAlign: 'left',
          rotation: 0,
          opacity: 1,
          locked: false,
          fieldId,
        } as TextElement)
    ),
  };
}

describe('Demo batch upload → export field mapping', () => {
  beforeEach(() => {
    demoStore.setActiveUserId('test-user-flow');
    localStorage.clear();
  });

  it('preserves work_phone and all other fields through upload + fetch + applyRecordData', async () => {
    const file = new File([TEST_TEXT], 'pasted-content.txt', { type: 'text/plain' });
    const upload = await demoBatchRepository.uploadBatch(file, 'project-1', 'Test Project');

    expect(upload.status).toBe('LOADED');

    const response = await batchRecordService.fetchRecordsForBatch(upload.id, {
      page: 1,
      pageSize: 10,
    });

    expect(response.data.records).toHaveLength(1);
    const record = response.data.records[0];
    expect(record.workPhone).toBe('+506 2222-1234');
    expect(record.email).toBe('john.doe@eco.com');
    // Person-name title casing is applied at ingest; this is intentional.
    expect(record.fullName).toBe('John Doe Xxx');

    const template = makeTemplate([
      'full_name',
      'work_phone',
      'work_phone_ext',
      'email',
      'business_name',
    ]);
    const populated = applyRecordData(template, record as unknown as BatchRecord);

    const texts = (populated.elements as TextElement[]).map((el) => el.text);
    expect(texts).toEqual([
      'John Doe Xxx',
      '+506 2222-1234',
      '123',
      'john.doe@eco.com',
      'Eco Corporation',
    ]);
  });
});
