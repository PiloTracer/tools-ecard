/**
 * renderCard full-record coverage:
 * the render worker must pass EVERY vCard field to the PNG renderer —
 * not just the 5 PostgreSQL searchable columns.
 */

import type { FullContactRecord } from '../src/core/database/cassandra';

jest.mock('../src/core/database', () => ({
  prisma: {
    batchRecord: {
      findUnique: jest.fn(),
    },
    templateMetadata: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../src/core/database/cassandra', () => ({
  getFullContactRecord: jest.fn(),
}));

jest.mock('../src/services/templateStorage', () => ({
  downloadTemplateJson: jest.fn(),
}));

jest.mock('../src/services/fabricTemplateRenderer', () => ({
  renderTemplateToPng: jest.fn(async (template: unknown, fieldValues: unknown) => ({
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    width: (template as { width: number }).width,
    height: (template as { width: number }).width,
    format: 'png' as const,
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require('../src/core/database');

const TEMPLATE_ROW = { id: 'tpl-1', storageUrl: 's3://templates/tpl-1.json' };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getFullContactRecord } = require('../src/core/database/cassandra');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { downloadTemplateJson } = require('../src/services/templateStorage');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderTemplateToPng } = require('../src/services/fabricTemplateRenderer');
// Require AFTER the mocks — this repo's custom transformer does NOT hoist
// jest.mock (plain ts.transpileModule), so top-level imports would load the
// real modules first (see tests/storage.test.ts for the established pattern).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderCard } = require('../src/services/renderer');

const FULL_RECORD: FullContactRecord = {
  batchRecordId: 'rec-1',
  batchId: 'batch-1',
  fullName: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
  workPhone: '+1 (555) 123-4567',
  workPhoneExt: '123',
  mobilePhone: '+1 (555) 987-6543',
  email: 'ada@example.com',
  addressStreet: '12 Analytical Engine Rd',
  addressCity: 'London',
  addressState: 'EN',
  addressPostal: 'SW1A 1AA',
  addressCountry: 'United Kingdom',
  socialInstagram: '@ada.codes',
  socialTwitter: '@ada_loves',
  socialFacebook: 'ada.lovelace.profile',
  businessName: 'Analytical Engines Ltd',
  businessTitle: 'Chief Mathematician',
  businessDepartment: 'Computing',
  businessUrl: 'https://analytical-engines.example',
  businessHours: 'Mon-Fri 9AM-5PM',
  businessAddressStreet: '8 Babbage Way',
  businessAddressCity: 'Cambridge',
  businessAddressState: 'CB',
  businessAddressPostal: 'CB2 1TN',
  businessAddressCountry: 'United Kingdom',
  businessLinkedin: 'linkedin.com/in/ada-lovelace',
  businessTwitter: '@analytical_ltd',
  personalUrl: 'https://ada.example',
  personalBio: 'First programmer',
  personalBirthday: '1815-12-10',
};

const EXPECTED_FIELD_VALUES: Record<string, string> = {
  fullName: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
  workPhone: '+1 (555) 123-4567',
  workPhoneExt: '123',
  mobilePhone: '+1 (555) 987-6543',
  email: 'ada@example.com',
  addressStreet: '12 Analytical Engine Rd',
  addressCity: 'London',
  addressState: 'EN',
  addressPostal: 'SW1A 1AA',
  addressCountry: 'United Kingdom',
  socialInstagram: '@ada.codes',
  socialTwitter: '@ada_loves',
  socialFacebook: 'ada.lovelace.profile',
  businessName: 'Analytical Engines Ltd',
  businessTitle: 'Chief Mathematician',
  businessDepartment: 'Computing',
  businessUrl: 'https://analytical-engines.example',
  businessHours: 'Mon-Fri 9AM-5PM',
  businessAddressStreet: '8 Babbage Way',
  businessAddressCity: 'Cambridge',
  businessAddressState: 'CB',
  businessAddressPostal: 'CB2 1TN',
  businessAddressCountry: 'United Kingdom',
  businessLinkedin: 'linkedin.com/in/ada-lovelace',
  businessTwitter: '@analytical_ltd',
  personalUrl: 'https://ada.example',
  personalBio: 'First programmer',
  personalBirthday: '1815-12-10',
};

describe('renderCard record enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.templateMetadata.findUnique.mockResolvedValue(TEMPLATE_ROW);
    // eslint-disable-next-line no-console
    console.log('DEBUG prisma mock is jest.fn:', typeof prisma.templateMetadata.findUnique.mockResolvedValue === 'function');
    downloadTemplateJson.mockResolvedValue({
      id: 'tpl-1',
      width: 400,
      height: 200,
      elements: [{ id: 't1', type: 'text', fieldId: 'full_name', fontSize: 16 }],
    });
  });

  it('passes ALL vCard fields to the PNG renderer when Cassandra has the full record', async () => {
    prisma.batchRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      batchId: 'batch-1',
      fullName: 'Ada Lovelace', // PG only mirrors 5 fields
      workPhone: null,
      mobilePhone: null,
      email: null,
      businessName: null,
    });
    getFullContactRecord.mockResolvedValue(FULL_RECORD);

    await renderCard({ templateId: 'tpl-1', recordId: 'rec-1', batchId: 'batch-1' });

    // eslint-disable-next-line no-console
    console.log('DEBUG templateMetadata calls:', prisma.templateMetadata.findUnique.mock.calls.length, 'renderTemplateToPng calls:', renderTemplateToPng.mock.calls.length);

    const fieldValues = renderTemplateToPng.mock.calls[0][1] as Record<string, string>;
    expect(fieldValues).toBeDefined();
    for (const [key, value] of Object.entries(EXPECTED_FIELD_VALUES)) {
      expect(fieldValues[key]).toBe(value);
    }
  });

  it('falls back to the PostgreSQL 5 searchable fields when Cassandra has no row', async () => {
    prisma.batchRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      batchId: 'batch-1',
      fullName: 'Ada Lovelace',
      workPhone: '+1 (555) 123-4567',
      mobilePhone: '+1 (555) 987-6543',
      email: 'ada@example.com',
      businessName: 'Analytical Engines Ltd',
    });
    getFullContactRecord.mockResolvedValue(null);

    await renderCard({ templateId: 'tpl-1', recordId: 'rec-1', batchId: 'batch-1' });

    const fieldValues = renderTemplateToPng.mock.calls[0][1] as Record<string, string>;
    expect(fieldValues.fullName).toBe('Ada Lovelace');
    expect(fieldValues.workPhone).toBe('+1 (555) 123-4567');
    // Fields absent from PG stay undefined (renderer falls back to placeholder)
    expect(fieldValues.addressStreet).toBeUndefined();
  });

  it('still renders with no record at all (undefined field values)', async () => {
    prisma.batchRecord.findUnique.mockResolvedValue(null);
    getFullContactRecord.mockResolvedValue(null);

    const result = await renderCard({ templateId: 'tpl-1', recordId: 'missing', batchId: 'batch-1' });
    expect(result.format).toBe('png');
    expect(renderTemplateToPng.mock.calls[0][1]).toBeUndefined();
  });
});
