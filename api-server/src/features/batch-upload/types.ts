// Batch upload feature types
import { BatchStatus } from '@prisma/client';

export interface BatchUploadRequest {
  file: Express.Multer.File;
  userId: string;
  userEmail: string;
  projectId: string;
  projectName: string;
}

export interface BatchUploadResponse {
  id: string;
  status: BatchStatus;
  message: string;
}

export interface BatchStatusResponse {
  id: string;
  status: BatchStatus;
  progress?: number;
  errorMessage?: string | null;
  fileName: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
}

export interface ListBatchesQuery {
  status?: BatchStatus;
  page?: number;
  limit?: number;
}

export interface ListBatchesResponse {
  batches: BatchListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface BatchListItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: BatchStatus;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
  recordsCount?: number | null;
  recordsProcessed?: number | null;
  parsingStartedAt?: Date | null;
  parsingCompletedAt?: Date | null;
}

export interface BatchCreateData {
  userId: string;
  userEmail: string;
  projectId: string;
  projectName: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  status?: BatchStatus;
}

export interface BatchUpdateData {
  status?: BatchStatus;
  errorMessage?: string | null;
  processedAt?: Date | null;
}

export interface SeaweedFSUploadResult {
  filePath: string;
  url: string;
  size: number;
}

export interface BatchProcessingJob {
  batchId: string;
  filePath: string;
  userEmail: string;
  // Phone formatting configuration from project settings
  workPhonePrefix?: string;      // e.g., "2222" for Costa Rica landlines
  defaultCountryCode?: string;   // e.g., "+(506)" for Costa Rica
}

export class BatchUploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'BatchUploadError';
  }
}

export const ALLOWED_FILE_TYPES = ['.csv', '.txt', '.vcf', '.xls', '.xlsx'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const BATCH_UPLOAD_QUEUE = 'batch-upload-queue';
export const BATCH_PARSE_QUEUE = 'batch-parse-queue';