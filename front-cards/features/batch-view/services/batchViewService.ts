/**
 * Batch View API Service
 * Client-side API calls for batch viewing
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  BatchListResponse,
  BatchResponse,
  DeleteBatchResponse,
  BatchStatsResponse,
  BatchListFilters,
} from '../types';
import { isDemoMode } from '@/features/demo/isDemoMode';
import { demoBatchRepository } from '@/features/demo/demoBatchRepository';

const API_BASE = '/api/batches';

export const batchViewService = {
  /**
   * Fetch list of batches with pagination and filters
   */
  async fetchBatches(options: {
    page?: number;
    pageSize?: number;
    filters?: BatchListFilters;
  } = {}): Promise<BatchListResponse> {
    if (isDemoMode()) {
      const page = options.page ?? 1;
      const pageSize = options.pageSize ?? 20;
      const listed = await demoBatchRepository.listBatches({ page, limit: pageSize });
      return {
        batches: listed.batches.map((b) => ({
          id: b.id,
          fileName: b.fileName,
          fileSize: b.fileSize,
          status: b.status as BatchListResponse['batches'][number]['status'],
          createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
          updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : String(b.updatedAt),
        })),
        total: listed.total,
        page: listed.page,
        limit: listed.limit,
      };
    }
    const { page = 1, pageSize = 20, filters = {} } = options;

    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', pageSize.toString());

    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.sortBy) {
      params.append('sortBy', filters.sortBy);
    }
    if (filters.sortOrder) {
      params.append('sortOrder', filters.sortOrder);
    }

    return await apiClient.get<BatchListResponse>(`${API_BASE}?${params.toString()}`);
  },

  /**
   * Fetch single batch by ID
   */
  async fetchBatch(batchId: string): Promise<BatchResponse> {
    if (isDemoMode()) {
      const status = await demoBatchRepository.getBatchStatus(batchId);
      return {
        batch: {
          id: status.id,
          fileName: status.fileName,
          fileSize: status.fileSize,
          status: status.status as BatchListResponse['batches'][number]['status'],
          createdAt:
            status.createdAt instanceof Date ? status.createdAt.toISOString() : String(status.createdAt),
          updatedAt:
            status.updatedAt instanceof Date ? status.updatedAt.toISOString() : String(status.updatedAt),
        },
      };
    }
    return await apiClient.get<BatchResponse>(`${API_BASE}/${batchId}`);
  },

  /**
   * Delete batch and all associated records
   */
  async deleteBatch(batchId: string): Promise<DeleteBatchResponse> {
    if (isDemoMode()) {
      await demoBatchRepository.deleteBatch(batchId);
      return { message: 'Demo batch deleted' };
    }
    return await apiClient.delete<DeleteBatchResponse>(`${API_BASE}/${batchId}`);
  },

  /**
   * Fetch batch statistics
   */
  async fetchBatchStats(): Promise<BatchStatsResponse> {
    if (isDemoMode()) {
      const stats = await demoBatchRepository.getBatchStats();
      return stats as BatchStatsResponse;
    }
    return await apiClient.get<BatchStatsResponse>(`${API_BASE}/stats`);
  },
};
