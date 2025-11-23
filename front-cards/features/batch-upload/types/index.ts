// Batch upload types for frontend

export enum BatchStatus {
  UPLOADED = 'UPLOADED',
  PARSING = 'PARSING',
  PARSED = 'PARSED',
  LOADED = 'LOADED',
  ERROR = 'ERROR'
}

export interface Batch {
  id: string;
  fileName: string;
  fileSize: number;
  status: BatchStatus;
  errorMessage?: string | null;
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
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

export interface ListBatchesResponse {
  batches: Batch[];
  total: number;
  page: number;
  limit: number;
}

export interface BatchStats {
  total: number;
  uploaded: number;
  parsing: number;
  parsed: number;
  loaded: number;
  error: number;
}

export interface FileUploadProps {
  onSuccess?: (batch: BatchUploadResponse) => void;
  onError?: (error: Error) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  className?: string;
}

export interface BatchStatusTrackerProps {
  batchId: string;
  onComplete?: (batch: BatchStatusResponse) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export interface FileValidationError {
  type: 'size' | 'type' | 'other';
  message: string;
}

export const ALLOWED_FILE_EXTENSIONS = ['.csv', '.txt', '.vcf', '.xls', '.xlsx'];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;