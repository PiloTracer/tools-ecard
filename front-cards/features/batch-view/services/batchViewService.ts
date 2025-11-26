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
    return await apiClient.get<BatchResponse>(`${API_BASE}/${batchId}`);
  },

  /**
   * Delete batch and all associated records
   */
  async deleteBatch(batchId: string): Promise<DeleteBatchResponse> {
    return await apiClient.delete<DeleteBatchResponse>(`${API_BASE}/${batchId}`);
  },

  /**
   * Fetch batch statistics
   */
  async fetchBatchStats(): Promise<BatchStatsResponse> {
    return await apiClient.get<BatchStatsResponse>(`${API_BASE}/stats`);
  },
};
