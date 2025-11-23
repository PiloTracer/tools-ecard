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