/**
 * RecordsList — record details view (all populated fields, not just table columns).
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithLocale } from '@/features/i18n/testUtils';
import { RecordsList } from './RecordsList';
import type { ContactRecord } from '../types';

const fullRecord: ContactRecord = {
  batchRecordId: 'rec-1',
  batchId: 'batch-1',
  createdAt: '2026-08-18T00:00:00Z',
  updatedAt: '2026-08-18T00:00:00Z',
  fullName: 'John Doe XXX',
  firstName: null,
  lastName: null,
  workPhone: '+506 2222-1234',
  workPhoneExt: '123',
  mobilePhone: '+506 8888-9999',
  email: 'john.doe@eco.com',
  addressStreet: '123 Main Street',
  addressCity: 'San José',
  addressState: 'SJ',
  addressPostal: '10101',
  addressCountry: 'Costa Rica',
  socialInstagram: '@johndoeX',
  socialTwitter: '@johndoe_official',
  socialFacebook: 'johndoe.profile',
  businessName: 'Eco Corporation',
  businessTitle: 'Senior ext',
  businessDepartment: 'Engineering',
  businessUrl: 'https://eco.com',
  businessHours: 'Mon-Fri 9AM-5PM',
  businessAddressStreet: '456 Business Ave',
  businessAddressCity: 'San Francisco',
  businessAddressState: 'CA',
  businessAddressPostal: '94107',
  businessAddressCountry: 'USA',
  businessLinkedin: 'linkedin.com/in/johndoe',
  businessTwitter: '@acme_official',
  personalUrl: 'https://johndoe.com',
  personalBio: 'Software engineer and photography enthusiast',
  personalBirthday: '2000-05-15',
  extra: null,
};

jest.mock('../hooks/useRecords', () => ({
  useRecords: () => ({
    records: [fullRecord],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    searchQuery: '',
    setSearchQuery: jest.fn(),
  }),
}));

jest.mock('../hooks/useRecordDelete', () => ({
  useRecordDelete: () => ({ deleteRecordAsync: jest.fn(), isDeleting: false }),
}));

jest.mock('./RenderStatusBadge', () => ({
  RenderStatusBadge: () => <span data-testid="render-status-badge" />,
}));

describe('RecordsList record details', () => {
  it('shows every populated field in the details view, not just the table columns', () => {
    renderWithLocale(<RecordsList batchId="batch-1" onEditRecord={jest.fn()} />);

    // Table itself shows the summary columns only.
    expect(screen.getByText('John Doe XXX')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View all fields' }));

    // Fields from every group are visible in the details modal.
    expect(screen.getByText('123 Main Street')).toBeInTheDocument();
    expect(screen.getByText('@johndoeX')).toBeInTheDocument();
    expect(screen.getByText('Mon-Fri 9AM-5PM')).toBeInTheDocument();
    expect(screen.getByText('94107')).toBeInTheDocument();
    expect(screen.getByText('linkedin.com/in/johndoe')).toBeInTheDocument();
    expect(screen.getByText('2000-05-15')).toBeInTheDocument();
    expect(screen.getByText('Software engineer and photography enthusiast')).toBeInTheDocument();
  });

  it('skips empty fields and groups', () => {
    renderWithLocale(<RecordsList batchId="batch-1" onEditRecord={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'View all fields' }));

    // firstName/lastName are null — their labels must not render.
    expect(screen.queryByText('First Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Last Name')).not.toBeInTheDocument();
  });
});
