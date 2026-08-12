// Batch Import Feature Types (Placeholder)
// This feature will handle the actual parsing and importing of batch files
// Currently a placeholder for future implementation

export interface BatchImportRequest {
  batchId: string;
  mappings?: FieldMapping[];
  options?: ImportOptions;
}

export interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transformRule?: string;
}

export interface ImportOptions {
  skipDuplicates?: boolean;
  validateEmails?: boolean;
  parseNames?: boolean;
  useLLM?: boolean;
}

export interface BatchImportResponse {
  batchId: string;
  recordsProcessed: number;
  recordsImported: number;
  recordsFailed: number;
  errors?: ImportError[];
}

export interface ImportError {
  row: number;
  field?: string;
  value?: string;
  message: string;
}

export interface ParsedRecord {
  fullName?: string;
  givenName?: string;
  familyName?: string;
  middleName?: string;
  email?: string;
  phone?: string;
  organization?: string;
  title?: string;
  department?: string;
  notes?: string;
  [key: string]: any;
}

export interface BatchParseJobData {
  batchId: string;
  filePath: string;
  userEmail: string;
  mappings?: FieldMapping[];
  options?: ImportOptions;
}

// --- Pass 3: column inspection (preview) + presets ---

export type MappingConfidence = 'alias' | 'canonical' | 'fuzzy' | 'none';

export interface ColumnAnalysis {
  sourceColumn: string;
  autoField: string | null;
  confidence: MappingConfidence;
  sampleValues: string[];
}

export interface InspectColumnsResult {
  success: boolean;
  file?: string;
  rows_total?: number;
  columns?: Array<{
    source_column: string;
    auto_field: string | null;
    confidence: MappingConfidence;
    sample_values: string[];
  }>;
  target_fields?: string[];
  error?: string;
}

export interface FieldMappingPresetDto {
  id: string;
  name: string;
  signature: string;
  mapping: FieldMapping[];
  createdAt: Date;
  updatedAt: Date;
}

// Placeholder error class
export class BatchImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'BatchImportError';
  }
}