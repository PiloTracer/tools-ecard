import { useState, useCallback } from 'react';
import { batchService } from '../services/batchService';
import {
  BatchUploadResponse,
  BatchStatus,
  Batch,
  ListBatchesResponse,
  BatchStats,
} from '../types';

export interface UseBatchUploadReturn {
  // State
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  batches: Batch[];
  batchStats: BatchStats | null;

  // Actions
  uploadBatch: (file: File) => Promise<BatchUploadResponse | null>;
  fetchBatches: (params?: { status?: BatchStatus; page?: number; limit?: number }) => Promise<void>;
  deleteBatch: (batchId: string) => Promise<void>;
  retryBatch: (batchId: string) => Promise<BatchUploadResponse | null>;
  fetchBatchStats: () => Promise<void>;
  fetchRecentBatches: (limit?: number) => Promise<void>;
  clearError: () => void;
}

export const useBatchUpload = (): UseBatchUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);

  const uploadBatch = useCallback(async (file: File): Promise<BatchUploadResponse | null> => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Use mock service for development
      const response = await batchService.uploadBatchMock(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Refresh batches list after successful upload
      await fetchRecentBatches();

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, []);

  const fetchBatches = useCallback(async (params?: {
    status?: BatchStatus;
    page?: number;
    limit?: number;
  }): Promise<void> => {
    try {
      setUploadError(null);
      const response = await batchService.listBatches(params);
      setBatches(response.batches);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch batches';
      setUploadError(errorMessage);
      console.error('Failed to fetch batches:', error);
    }
  }, []);

  const deleteBatch = useCallback(async (batchId: string): Promise<void> => {
    try {
      setUploadError(null);
      await batchService.deleteBatch(batchId);

      // Remove from local state
      setBatches((prev) => prev.filter((batch) => batch.id !== batchId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete batch';
      setUploadError(errorMessage);
      throw error;
    }
  }, []);

  const retryBatch = useCallback(async (batchId: string): Promise<BatchUploadResponse | null> => {
    try {
      setUploadError(null);
      const response = await batchService.retryBatch(batchId);

      // Update local state
      setBatches((prev) =>
        prev.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: BatchStatus.UPLOADED, errorMessage: null }
            : batch
        )
      );

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry batch';
      setUploadError(errorMessage);
      return null;
    }
  }, []);

  const fetchBatchStats = useCallback(async (): Promise<void> => {
    try {
      setUploadError(null);
      const stats = await batchService.getBatchStats();
      setBatchStats(stats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stats';
      setUploadError(errorMessage);
      console.error('Failed to fetch batch stats:', error);
    }
  }, []);

  const fetchRecentBatches = useCallback(async (limit: number = 5): Promise<void> => {
    try {
      setUploadError(null);
      const recentBatches = await batchService.getRecentBatches(limit);
      setBatches(recentBatches);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch recent batches';
      setUploadError(errorMessage);
      console.error('Failed to fetch recent batches:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  return {
    // State
    isUploading,
    uploadProgress,
    uploadError,
    batches,
    batchStats,

    // Actions
    uploadBatch,
    fetchBatches,
    deleteBatch,
    retryBatch,
    fetchBatchStats,
    fetchRecentBatches,
    clearError,
  };
};