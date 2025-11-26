/**
 * Batch View Types
 */

export type BatchStatus = 'UPLOADED' | 'PARSING' | 'PARSED' | 'LOADED' | 'ERROR';

export interface Batch {
  id: string;
  fileName: string;
  fileSize: number;
  status: BatchStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt?: string | null;
  recordsCount?: number | null;
  recordsProcessed?: number | null;
  parsingStartedAt?: string | null;
  parsingCompletedAt?: string | null;
}

export interface BatchListResponse {
  batches: Batch[];
  total: number;
  page: number;
  limit: number;
}

export interface BatchResponse {
  batch: Batch;
}

export interface DeleteBatchResponse {
  message?: string;
}

export interface BatchStatsResponse {
  total: number;
  uploaded: number;
  parsing: number;
  parsed: number;
  loaded: number;
  error: number;
}

export interface BatchListFilters {
  status?: BatchStatus;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
