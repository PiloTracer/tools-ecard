/**
 * useBatches Hook
 * Fetch and manage batch list with React Query
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { batchViewService } from '../services/batchViewService';
import type { BatchListFilters } from '../types';
import { useEffect } from 'react';

export interface UseBatchesOptions {
  page?: number;
  pageSize?: number;
  filters?: BatchListFilters;
  autoRefreshParsing?: boolean; // Auto-refresh when batches are parsing
}

export function useBatches(options: UseBatchesOptions = {}) {
  const {
    page = 1,
    pageSize = 20,
    filters = {},
    autoRefreshParsing = true,
  } = options;

  const queryClient = useQueryClient();

  const queryKey = ['batches', page, pageSize, filters];

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => batchViewService.fetchBatches({ page, pageSize, filters }),
    staleTime: 5000, // Cache for 5 seconds
    retry: 2,
  });

  // Auto-refresh if any batch is in PARSING status
  useEffect(() => {
    if (!autoRefreshParsing || !data?.batches) return;

    const hasParsingBatches = data.batches.some(
      (batch) => batch.status === 'PARSING'
    );

    if (hasParsingBatches) {
      const intervalId = setInterval(() => {
        refetch();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(intervalId);
    }
  }, [data, autoRefreshParsing, refetch]);

  return {
    batches: data?.batches || [],
    pagination: data ? {
      total: data.total,
      page: data.page,
      pageSize: data.limit,
      totalPages: Math.ceil(data.total / data.limit),
    } : undefined,
    isLoading,
    isError,
    error,
    refetch,
  };
}
