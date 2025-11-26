/**
 * Batch View Types
 */

export type BatchStatus = 'UPLOADED' | 'PARSING' | 'PARSED' | 'LOADED' | 'ERROR';

export interface Batch {
  id: string;
  userId: string;
  userEmail: string;
  projectId: string;
  projectName: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  status: BatchStatus;
  errorMessage: string | null;
  recordsCount: number | null;
  recordsProcessed: number | null;
  parsingStartedAt: string | null;
  parsingCompletedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recordCount?: number; // Added by batch-view service
}

export interface BatchListResponse {
  success: boolean;
  data: {
    batches: Batch[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

export interface BatchResponse {
  success: boolean;
  data: Batch;
}

export interface DeleteBatchResponse {
  success: boolean;
  data: {
    success: boolean;
    deletedRecordsCount: number;
  };
  message: string;
}

export interface BatchStatsResponse {
  success: boolean;
  data: {
    total: number;
    uploaded: number;
    parsing: number;
    parsed: number;
    loaded: number;
    error: number;
  };
}

export interface BatchListFilters {
  status?: BatchStatus;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
