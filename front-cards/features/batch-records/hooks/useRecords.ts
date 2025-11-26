/**
 * useRecords Hook
 * Fetch and manage records for a batch with React Query
 */

import { useQuery } from '@tanstack/react-query';
import { batchRecordService } from '../services/batchRecordService';
import { useState, useMemo } from 'react';
import { searchRecords } from '../utils/recordSearcher';

export interface UseRecordsOptions {
  batchId: string;
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}

export function useRecords(options: UseRecordsOptions) {
  const { batchId, page = 1, pageSize = 50, searchQuery = '' } = options;

  const [clientSearch, setClientSearch] = useState(searchQuery);

  const queryKey = ['batch-records', batchId, page, pageSize];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => batchRecordService.fetchRecordsForBatch(batchId, { page, pageSize }),
    staleTime: 30000, // Cache for 30 seconds
    retry: 2,
  });

  // Client-side search
  const filteredRecords = useMemo(() => {
    if (!data?.data?.records) return [];
    if (!clientSearch) return data.data.records;
    return searchRecords(data.data.records, clientSearch);
  }, [data?.data?.records, clientSearch]);

  return {
    batchId: data?.data?.batchId,
    batchFileName: data?.data?.batchFileName,
    batchStatus: data?.data?.batchStatus,
    records: filteredRecords,
    allRecords: data?.data?.records || [],
    pagination: data?.data?.pagination,
    isLoading,
    isError,
    error,
    refetch,
    searchQuery: clientSearch,
    setSearchQuery: setClientSearch,
  };
}
