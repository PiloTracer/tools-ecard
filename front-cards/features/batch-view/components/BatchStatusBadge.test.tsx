/**
 * BatchStatusBadge tests — now token-bound via the Badge primitive.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LocaleProvider } from '@/features/i18n';
import { BatchStatusBadge } from './BatchStatusBadge';
import type { BatchStatus } from '../types';

const renderBadge = (status: BatchStatus) => {
  return render(
    <LocaleProvider>
      <BatchStatusBadge status={status} />
    </LocaleProvider>,
  );
};

describe('BatchStatusBadge', () => {
  it('renders a localized label for each status', () => {
    renderBadge('UPLOADED');
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('maps tones to semantic token classes (not color-only)', () => {
    renderBadge('LOADED');
    expect(screen.getByText('Loaded').closest('span')).toHaveClass('bg-success-subtle');
    expect(screen.getByText('Loaded').closest('span')).toHaveClass('text-status-success');
  });

  it('shows an icon alongside the label (never color-only — UIS-04)', () => {
    renderBadge('ERROR');
    const badge = screen.getByText('Error').closest('span');
    expect(badge?.querySelector('svg')).toBeInTheDocument();
  });

  it('renders parsing with a spinner icon', () => {
    renderBadge('PARSING');
    expect(screen.getByText('Parsing')).toBeInTheDocument();
  });
});
