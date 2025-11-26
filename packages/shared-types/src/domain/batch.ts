/**
 * Batch domain model
 * Represents a batch file upload and parsing job
 */

// Batch status matching Prisma schema
export type BatchStatus = 'UPLOADED' | 'PARSING' | 'PARSED' | 'LOADED' | 'ERROR';

export type Batch = {
  id: string;
  userId: string;
  userEmail: string;
  projectId: string;
  projectName: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  status: BatchStatus;
  errorMessage?: string | null;

  // Parsing tracking fields
  recordsCount?: number | null;
  recordsProcessed?: number | null;
  parsingStartedAt?: Date | null;
  parsingCompletedAt?: Date | null;

  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// Searchable record in PostgreSQL (5 fields)
export type BatchRecord = {
  id: string;
  batchId: string;
  fullName?: string | null;
  workPhone?: string | null;
  mobilePhone?: string | null;
  email?: string | null;
  businessName?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Complete contact record in Cassandra (all vCard fields)
export type ContactRecord = {
  batchRecordId: string;
  batchId: string;
  createdAt: Date;
  updatedAt: Date;

  // Core Contact Fields
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;

  // Contact Methods
  workPhone?: string | null;
  workPhoneExt?: string | null;
  mobilePhone?: string | null;
  email?: string | null;

  // Address
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostal?: string | null;
  addressCountry?: string | null;

  // Social Profiles
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialFacebook?: string | null;

  // Business Fields
  businessName?: string | null;
  businessTitle?: string | null;
  businessDepartment?: string | null;
  businessUrl?: string | null;
  businessHours?: string | null;

  // Business Address
  businessAddressStreet?: string | null;
  businessAddressCity?: string | null;
  businessAddressState?: string | null;
  businessAddressPostal?: string | null;
  businessAddressCountry?: string | null;

  // Professional Profiles
  businessLinkedin?: string | null;
  businessTwitter?: string | null;

  // Personal Fields
  personalUrl?: string | null;
  personalBio?: string | null;
  personalBirthday?: string | null;

  // Extra fields for extensibility
  extra?: Record<string, string>;
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
