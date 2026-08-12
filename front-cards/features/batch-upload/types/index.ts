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
  recordsCount?: number | null;
  recordsProcessed?: number | null;
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
  recordsCount?: number | null;
  recordsProcessed?: number | null;
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

// --- Pass 3: user-defined field mapping ---

export type MappingConfidence = 'alias' | 'canonical' | 'fuzzy' | 'none';

/** Explicit mapping target sending the column to the record's extra data verbatim. */
export const MAPPING_IGNORE_TARGET = 'ignore';

export interface FieldMappingEntry {
  sourceColumn: string;
  /** Canonical snake_case field id, or MAPPING_IGNORE_TARGET */
  targetField: string;
}

export interface ColumnMappingAnalysis {
  sourceColumn: string;
  /** Canonical snake_case field id when auto-mapped, else null */
  autoField: string | null;
  confidence: MappingConfidence;
  sampleValues: string[];
}

export interface CanonicalTargetField {
  id: string;
  labelEn: string;
  labelEs: string;
  category: string;
}

export interface FieldMappingPreset {
  id: string;
  name: string;
  signature: string;
  mapping: FieldMappingEntry[];
}

export interface MappingPreview {
  fileName: string;
  rowsTotal: number;
  columns: ColumnMappingAnalysis[];
  targetFields: CanonicalTargetField[];
  suggestedPreset: FieldMappingPreset | null;
}

export const ALLOWED_FILE_EXTENSIONS = ['.csv', '.txt', '.md', '.vcf', '.xls', '.xlsx'];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;