/**
 * BatchFilters Component
 * Filter controls for batch list — SearchBar + status Select + Clear (S2 SPEC §4/§6).
 */

'use client';

import React from 'react';
import type { BatchStatus, BatchListFilters } from '../types';
import { SearchBar, Select, Button } from '@/components/ui';
import { useTranslation } from '@/features/i18n';

interface BatchFiltersProps {
  filters: BatchListFilters;
  onFiltersChange: (filters: BatchListFilters) => void;
}

export const BatchFilters: React.FC<BatchFiltersProps> = ({ filters, onFiltersChange }) => {
  const { t } = useTranslation();
  const statuses: (BatchStatus | '')[] = ['', 'UPLOADED', 'PARSING', 'PARSED', 'LOADED', 'ERROR'];

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as BatchStatus | '';
    onFiltersChange({
      ...filters,
      status: value || undefined,
    });
  };

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      search: value || undefined,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Boolean(filters.status || filters.search);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-elevated p-4 shadow-elevation-2">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search */}
        <div className="flex-1">
          <label htmlFor="search" className="mb-1 block text-sm font-medium text-text-primary">
            {t('batches.searchPlaceholder')}
          </label>
          <SearchBar
            id="search"
            value={filters.search || ''}
            onValueChange={handleSearchChange}
            placeholder={t('batches.searchPlaceholder')}
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-48">
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-text-primary">
            {t('batches.filterStatusLabel')}
          </label>
          <Select id="status" value={filters.status || ''} onChange={handleStatusChange}>
            <option value="">{t('batches.allStatuses')}</option>
            {statuses.slice(1).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('batches.clearFilters')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
