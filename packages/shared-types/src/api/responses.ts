/**
 * API Response types
 * Contracts for server→client communication
 */

import type { Template, Batch, CanonicalStaff, RenderJob } from '../domain';

// Standard API response wrapper
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// Template Responses
export type TemplateListResponse = ApiResponse<{
  templates: Template[];
  total: number;
  page: number;
  pageSize: number;
}>;

export type TemplateResponse = ApiResponse<Template>;

// Batch Responses
export type BatchListResponse = ApiResponse<{
  batches: Batch[];
  total: number;
  page: number;
  pageSize: number;
}>;

export type BatchResponse = ApiResponse<Batch>;

export type BatchDetailResponse = ApiResponse<{
  batch: Batch;
  records: CanonicalStaff[];
  jobs: RenderJob[];
}>;

// Name Parser Response
export type NameParseResponse = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  confidence: number;
  creditsUsed: number;
};
