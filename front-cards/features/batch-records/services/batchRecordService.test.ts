/**
 * @jest-environment jsdom
 */

import { enterDemoMode, exitDemoMode } from '@/features/demo/isDemoMode';
import { demoStore, newDemoId } from '@/features/demo/demoStore';
import { batchRecordService } from './batchRecordService';

describe('batchRecordService (demo mode)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    enterDemoMode();
  });

  afterEach(() => {
    exitDemoMode();
  });

  it('preserves non-core fields (and headers/cols) across updateRecord', async () => {
    const batchId = newDemoId('batch');
    const recordId = newDemoId('rec');

    demoStore.setBatchRecords(batchId, [
      {
        id: recordId,
        batchId,
        rowIndex: 0,
        data: {
          headers: ['Nombre completo', 'Correo', 'Empresa'],
          cols: ['Ada Lovelace', 'ada@example.com', 'Acme Inc'],
          fields: {
            fullName: 'Ada Lovelace',
            email: 'ada@example.com',
            businessName: 'Acme Inc',
          },
        },
        status: 'completed',
        renderStatus: 'completed',
        renderProgress: 100,
      },
    ]);

    await batchRecordService.updateRecord(batchId, recordId, { firstName: 'Ada' });

    const { data } = await batchRecordService.fetchRecord(batchId, recordId);
    // The field that was actually edited took effect...
    expect(data.firstName).toBe('Ada');
    // ...and fields untouched by the update were NOT dropped (previous bug:
    // updateRecord rewrote `data` down to `{ cols: [fullName, firstName,
    // lastName, email] }`, silently losing businessName/etc. and the
    // original headers/cols on every edit).
    expect(data.fullName).toBe('Ada Lovelace');
    expect(data.email).toBe('ada@example.com');
    expect(data.businessName).toBe('Acme Inc');

    const raw = demoStore.getBatchRecords<{ data: { headers?: string[]; cols?: string[] } }>(
      batchId
    )[0];
    expect(raw.data.headers).toEqual(['Nombre completo', 'Correo', 'Empresa']);
    expect(raw.data.cols).toEqual(['Ada Lovelace', 'ada@example.com', 'Acme Inc']);
  });

  it('does not read firstName/lastName/email positionally from cols once a row has structured fields', async () => {
    // Regression: a sheet with a single combined "full name" column (no
    // separate first/last columns) produced `fields: { fullName, email }`
    // with no `firstName`. mapDemoRecord then fell back to the LEGACY
    // fixed [fullName, firstName, lastName, email] cols layout, so
    // `firstName` ended up holding whatever the sheet's actual 2nd column
    // was (here: the email) — wrong data on cards using a first_name field.
    const batchId = newDemoId('batch');
    const recordId = newDemoId('rec');

    demoStore.setBatchRecords(batchId, [
      {
        id: recordId,
        batchId,
        rowIndex: 0,
        data: {
          headers: ['Nombre y Apellido', 'Email', 'Puesto'],
          cols: ['Juan Perez', 'juan@example.com', 'Manager'],
          fields: { fullName: 'Juan Perez', email: 'juan@example.com', businessTitle: 'Manager' },
        },
        status: 'completed',
        renderStatus: 'completed',
        renderProgress: 100,
      },
    ]);

    const { data } = await batchRecordService.fetchRecord(batchId, recordId);
    expect(data.fullName).toBe('Juan Perez');
    expect(data.firstName).toBeNull();
    expect(data.lastName).toBeNull();
    expect(data.email).toBe('juan@example.com');
  });

  it('legacy rows without structured fields still fall back to positional cols', async () => {
    const batchId = newDemoId('batch');
    const recordId = newDemoId('rec');

    demoStore.setBatchRecords(batchId, [
      {
        id: recordId,
        batchId,
        rowIndex: 0,
        data: { raw: 'Ada,Lovelace,,ada@example.com', cols: ['Ada', 'Lovelace', '', 'ada@example.com'] },
        status: 'completed',
        renderStatus: 'completed',
        renderProgress: 100,
      },
    ]);

    const { data } = await batchRecordService.fetchRecord(batchId, recordId);
    expect(data.fullName).toBe('Ada');
    expect(data.firstName).toBe('Lovelace');
    expect(data.email).toBe('ada@example.com');
  });
});
