/**
 * API Request types
 * Contracts for client→server communication
 */

import type { TemplateElement } from '../domain/template';

// Template Requests
export type CreateTemplateRequest = {
  name: string;
  width: number;
  height: number;
  backgroundUrl?: string;
  exportDpi?: number;
};

export type UpdateTemplateRequest = Partial<{
  name: string;
  description: string;
  elements: TemplateElement[];
  exportDpi: number;
  phonePrefix: string;
  extensionLength: number;
}>;

// Batch Requests
export type CreateBatchRequest = {
  name: string;
  templateId: string;
  records: RawStaffRecord[];
  useLLMParsing: boolean;
};

export type RawStaffRecord = {
  // Can be explicit fields or single fullName
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  secondLastName?: string;

  position: string;
  department?: string;
  email: string;
  telRaw?: string;
  whatsapp?: string;
  web?: string;

  extra?: Record<string, string>;
};

// Name Parser Request
export type NameParseRequest = {
  fullName: string;
  locale?: string;
};
