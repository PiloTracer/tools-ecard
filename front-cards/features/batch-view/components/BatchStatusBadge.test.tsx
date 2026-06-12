import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BatchStatusBadge } from './BatchStatusBadge';
import type { BatchStatus } from '../types';

describe('BatchStatusBadge', () => {
  const renderBadge = (status: BatchStatus, className?: string) => {
    return render(<BatchStatusBadge status={status} className={className} />);
  };

  it('renders UPLOADED status with correct styling', () => {
    renderBadge('UPLOADED');
    expect(screen.getByText('UPLOADED')).toBeInTheDocument();
    expect(screen.getByText('UPLOADED').closest('div')).toHaveClass('text-blue-700');
    expect(screen.getByText('UPLOADED').closest('div')).toHaveClass('bg-blue-100');
  });

  it('renders PARSING status with correct styling', () => {
    renderBadge('PARSING');
    expect(screen.getByText('PARSING')).toBeInTheDocument();
    expect(screen.getByText('PARSING').closest('div')).toHaveClass('text-yellow-700');
    expect(screen.getByText('PARSING').closest('div')).toHaveClass('bg-yellow-100');
  });

  it('renders PARSED status with correct styling', () => {
    renderBadge('PARSED');
    expect(screen.getByText('PARSED')).toBeInTheDocument();
    expect(screen.getByText('PARSED').closest('div')).toHaveClass('text-purple-700');
    expect(screen.getByText('PARSED').closest('div')).toHaveClass('bg-purple-100');
  });

  it('renders LOADED status with correct styling', () => {
    renderBadge('LOADED');
    expect(screen.getByText('LOADED')).toBeInTheDocument();
    expect(screen.getByText('LOADED').closest('div')).toHaveClass('text-green-700');
    expect(screen.getByText('LOADED').closest('div')).toHaveClass('bg-green-100');
  });

  it('renders ERROR status with correct styling', () => {
    renderBadge('ERROR');
    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(screen.getByText('ERROR').closest('div')).toHaveClass('text-red-700');
    expect(screen.getByText('ERROR').closest('div')).toHaveClass('bg-red-100');
  });

  it('applies custom className', () => {
    renderBadge('UPLOADED', 'custom-class');
    expect(screen.getByText('UPLOADED').closest('div')).toHaveClass('custom-class');
  });

  it('renders all status icons', () => {
    const statuses: BatchStatus[] = ['UPLOADED', 'PARSING', 'PARSED', 'LOADED', 'ERROR'];
    statuses.forEach((status) => {
      const { unmount } = renderBadge(status);
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    });
  });

  it('renders as inline-flex', () => {
    renderBadge('UPLOADED');
    const badge = screen.getByText('UPLOADED').closest('div');
    expect(badge).toHaveClass('inline-flex');
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('text-xs');
  });
});
