/**
 * useBatchDelete Hook
 * Delete batch with optimistic updates
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { batchViewService } from '../services/batchViewService';

export function useBatchDelete() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (batchId: string) => batchViewService.deleteBatch(batchId),
    onSuccess: (data) => {
      // Invalidate batch queries to refetch
      queryClient.invalidateQueries({ queryKey: ['batches'] });

      return data;
    },
    onError: (error) => {
      console.error('Failed to delete batch:', error);
    },
  });

  return {
    deleteBatch: mutation.mutate,
    deleteBatchAsync: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
