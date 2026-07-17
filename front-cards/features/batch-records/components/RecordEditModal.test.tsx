import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecordEditModal } from './RecordEditModal';
import type { ContactRecord } from '../types';

jest.mock('../hooks/useRecordEdit', () => ({
  useRecordEdit: () => ({
    updateRecordAsync: jest.fn(),
    isUpdating: false,
    isSuccess: false,
    reset: jest.fn(),
  }),
}));

function makeRecord(overrides: Partial<ContactRecord> = {}): ContactRecord {
  return {
    batchRecordId: 'rec-1',
    batchId: 'batch-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fullName: 'Ada Lovelace',
    firstName: 'Ada',
    lastName: 'Lovelace',
    workPhone: null,
    workPhoneExt: null,
    mobilePhone: null,
    email: 'ada@example.com',
    addressStreet: null,
    addressCity: null,
    addressState: null,
    addressPostal: null,
    addressCountry: null,
    socialInstagram: null,
    socialTwitter: null,
    socialFacebook: null,
    businessName: null,
    businessTitle: null,
    businessDepartment: null,
    businessUrl: null,
    businessHours: null,
    businessAddressStreet: null,
    businessAddressCity: null,
    businessAddressState: null,
    businessAddressPostal: null,
    businessAddressCountry: null,
    businessLinkedin: null,
    businessTwitter: null,
    personalUrl: null,
    personalBio: null,
    personalBirthday: null,
    extra: null,
    ...overrides,
  };
}

describe('RecordEditModal (F8 focus regression)', () => {
  it('keeps focus on the active field while typing multiple characters', () => {
    const record = makeRecord();

    const { rerender } = render(
      <RecordEditModal
        record={record}
        batchId="batch-1"
        isOpen
        onClose={jest.fn()}
      />
    );

    const input = screen.getByLabelText('Full Name') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: 'Ada Lovelace Updated' } });

    expect(input).toHaveFocus();
    expect(input).toHaveValue('Ada Lovelace Updated');

    rerender(
      <RecordEditModal
        record={{ ...record, updatedAt: '2026-01-02T00:00:00Z' }}
        batchId="batch-1"
        isOpen
        onClose={jest.fn()}
      />
    );

    const inputAfter = screen.getByLabelText('Full Name') as HTMLInputElement;
    expect(inputAfter).toHaveFocus();
    expect(inputAfter).toHaveValue('Ada Lovelace Updated');
  });
});
