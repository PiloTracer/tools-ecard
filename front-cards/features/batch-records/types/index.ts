/**
 * Batch Records Types
 * All types for batch record management
 */

import type { BatchStatus } from '@/features/batch-view';

export interface ContactRecord {
  // IDs
  batchRecordId: string;
  batchId: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Core Contact Fields
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;

  // Contact Methods
  workPhone: string | null;
  workPhoneExt: string | null;
  mobilePhone: string | null;
  email: string | null;

  // Address
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostal: string | null;
  addressCountry: string | null;

  // Social Profiles
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialFacebook: string | null;

  // Business Fields
  businessName: string | null;
  businessTitle: string | null;
  businessDepartment: string | null;
  businessUrl: string | null;
  businessHours: string | null;

  // Business Address
  businessAddressStreet: string | null;
  businessAddressCity: string | null;
  businessAddressState: string | null;
  businessAddressPostal: string | null;
  businessAddressCountry: string | null;

  // Professional Profiles
  businessLinkedin: string | null;
  businessTwitter: string | null;

  // Personal Fields
  personalUrl: string | null;
  personalBio: string | null;
  personalBirthday: string | null;

  // Extra
  extra: Record<string, string> | null;
}

export interface RecordsListResponse {
  success: boolean;
  data: {
    batchId: string;
    batchFileName: string;
    batchStatus: BatchStatus | string;
    records: ContactRecord[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

export interface RecordResponse {
  success: boolean;
  data: ContactRecord;
}

export interface UpdateRecordResponse {
  success: boolean;
  data: ContactRecord;
  message: string;
}

export interface DeleteRecordResponse {
  success: boolean;
  message: string;
}

export interface RecordUpdateInput {
  // Allow partial updates of any field
  [key: string]: any;
}
