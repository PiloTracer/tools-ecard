/**
 * Batch Record API Service
 * Client-side API calls for record management
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  RecordsListResponse,
  RecordResponse,
  UpdateRecordResponse,
  DeleteRecordResponse,
  RecordUpdateInput,
} from '../types';

export const batchRecordService = {
  /**
   * Fetch all records for a batch
   */
  async fetchRecordsForBatch(
    batchId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ): Promise<RecordsListResponse> {
    const { page = 1, pageSize = 50, search } = options;

    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (search) {
      params.append('search', search);
    }

    return await apiClient.get<RecordsListResponse>(
      `/api/batches/${batchId}/records?${params.toString()}`
    );
  },

  /**
   * Fetch single record by ID
   */
  async fetchRecord(batchId: string, recordId: string): Promise<RecordResponse> {
    return await apiClient.get<RecordResponse>(`/api/batches/${batchId}/records/${recordId}`);
  },

  /**
   * Update record
   */
  async updateRecord(
    batchId: string,
    recordId: string,
    updates: RecordUpdateInput
  ): Promise<UpdateRecordResponse> {
    return await apiClient.put<UpdateRecordResponse>(
      `/api/batches/${batchId}/records/${recordId}`,
      updates
    );
  },

  /**
   * Delete record
   */
  async deleteRecord(batchId: string, recordId: string): Promise<DeleteRecordResponse> {
    return await apiClient.delete<DeleteRecordResponse>(`/api/batches/${batchId}/records/${recordId}`);
  },
};
