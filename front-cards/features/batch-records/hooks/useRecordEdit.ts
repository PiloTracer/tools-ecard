/**
 * useRecordEdit Hook
 * Update record with optimistic updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchRecordService } from '../services/batchRecordService';
import type { RecordUpdateInput } from '../types';

interface UseRecordEditOptions {
  batchId: string;
}

export function useRecordEdit({ batchId }: UseRecordEditOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ recordId, updates }: { recordId: string; updates: RecordUpdateInput }) =>
      batchRecordService.updateRecord(batchId, recordId, updates),
    onSuccess: () => {
      // Invalidate batch-records queries to refetch
      queryClient.invalidateQueries({ queryKey: ['batch-records', batchId] });
    },
    onError: (error) => {
      console.error('Failed to update record:', error);
    },
  });

  return {
    updateRecord: mutation.mutate,
    updateRecordAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
