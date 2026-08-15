/**
 * BatchList Component
 * Main list container for batches — filters, card grid, states (S2 SPEC).
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBatches } from '../hooks/useBatches';
import { BatchCard } from './BatchCard';
import { BatchFilters } from './BatchFilters';
import { StatePanel, Pagination, Button } from '@/components/ui';
import { useTranslation } from '@/features/i18n';
import type { BatchListFilters } from '../types';

export const BatchList: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<BatchListFilters>({});

  const { batches, pagination, isLoading, isError, error, refetch } = useBatches({
    page,
    pageSize,
    filters,
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFiltersChange = (newFilters: BatchListFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const hasActiveFilters = Boolean(filters.search || filters.status);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <BatchFilters filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Results Count */}
      {!isLoading && !isError && pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {t('batches.showingXofY', { shown: batches.length, total: pagination.total })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t('batches.refresh')}
          </Button>
        </div>
      )}

      {/* Loading — no bare "Loading…" (doc 01 principle 1) */}
      {isLoading && batches.length === 0 && <StatePanel kind="loading" title={t('batches.loading')} />}

      {/* Error — with retry */}
      {isError && batches.length === 0 && (
        <StatePanel
          kind="error"
          title={t('batches.noBatches')}
          description={error instanceof Error ? error.message : undefined}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              {t('batches.refresh')}
            </Button>
          }
        />
      )}

      {/* Empty — branches by filters (D13) */}
      {!isLoading && !isError && batches.length === 0 && (
        <StatePanel
          kind="empty"
          title={t('batches.noBatches')}
          description={hasActiveFilters ? t('batches.filteredNoBatchesHint') : t('batches.noBatchesHint')}
          action={
            hasActiveFilters ? undefined : (
              <Button onClick={() => router.push('/dashboard')}>{t('batches.uploadNew')}</Button>
            )
          }
        />
      )}

      {/* Batch List */}
      {batches.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} onDeleted={() => refetch()} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="rounded-lg border border-border-subtle bg-surface-elevated px-4 py-3 shadow-elevation-1">
          <Pagination
            page={page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            prevLabel={t('batches.previous')}
            nextLabel={t('batches.next')}
            pageIndicatorLabel={t('batches.pageXofY', { page, totalPages: pagination.totalPages })}
          />
        </div>
      )}
    </div>
  );
};
