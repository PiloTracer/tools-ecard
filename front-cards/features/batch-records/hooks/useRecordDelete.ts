/**
 * useRecordDelete Hook
 * Delete record with cache updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchRecordService } from '../services/batchRecordService';

interface UseRecordDeleteOptions {
  batchId: string;
}

export function useRecordDelete({ batchId }: UseRecordDeleteOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (recordId: string) => batchRecordService.deleteRecord(batchId, recordId),
    onSuccess: () => {
      // Invalidate batch-records queries to refetch
      queryClient.invalidateQueries({ queryKey: ['batch-records', batchId] });
      // Also invalidate batch queries (record count changed)
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
    onError: (error) => {
      console.error('Failed to delete record:', error);
    },
  });

  return {
    deleteRecord: mutation.mutate,
    deleteRecordAsync: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
