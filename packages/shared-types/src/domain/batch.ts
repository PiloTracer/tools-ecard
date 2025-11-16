/**
 * Batch domain model
 * Represents a batch card generation job
 */

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ImportSource = 'excel' | 'text' | 'api';

export type Batch = {
  id: string;
  userId: string;
  templateId: string;
  name: string;
  status: BatchStatus;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  importSource: ImportSource;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};

export type CanonicalStaff = {
  id: string;
  batchId: string;

  // Name fields
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  secondLastName?: string;

  // Job details
  position: string;
  department?: string;

  // Contact
  email: string;
  telRaw?: string;
  phone?: string;
  extension?: string;
  whatsapp?: string;
  web?: string;

  // Layout
  layout: StaffLayout;

  // File naming
  fileSlug: string;
  fileNameKey: string;

  // Metadata
  extra?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

export type StaffLayout = {
  nameSize: number;
  cargoSize: number;
  inX: number;
  inY: number;
  phoneX: number;
  phoneY: number;
  phoneShow: boolean;
  whaX: number;
  whaY: number;
  whatsappShow: boolean;
  webX: number;
  webY: number;
  webShow: boolean;
  texto1: string;
  texto2: string;
  texto3: string;
};

export type RenderJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type RenderJob = {
  id: string;
  batchId: string;
  recordId: string;
  templateId: string;
  status: RenderJobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  outputUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};
