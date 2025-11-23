import { z } from 'zod';
import { BatchStatus } from '@prisma/client';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../types';

// File upload validation schema
export const uploadFileSchema = z.object({
  file: z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.string(),
    size: z.number()
      .max(MAX_FILE_SIZE, `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`),
    buffer: z.instanceof(Buffer).optional(),
    path: z.string().optional(),
  }).refine(
    (file) => {
      const fileExtension = file.originalname
        .toLowerCase()
        .substring(file.originalname.lastIndexOf('.'));
      return ALLOWED_FILE_TYPES.includes(fileExtension);
    },
    {
      message: `File type must be one of: ${ALLOWED_FILE_TYPES.join(', ')}`,
    }
  ),
});

// Get batch status validation schema
export const getBatchStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID format'),
  }),
});

// List batches validation schema
export const listBatchesSchema = z.object({
  query: z.object({
    status: z.nativeEnum(BatchStatus).optional(),
    page: z.string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, 'Page must be a positive number')
      .default('1')
      .optional(),
    limit: z.string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .default('20')
      .optional(),
  }).optional(),
});

// Delete batch validation schema
export const deleteBatchSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid batch ID format'),
  }),
});

// Sanitize filename to prevent path traversal
export function sanitizeFileName(fileName: string): string {
  // Remove any path separators and dangerous characters
  return fileName
    .replace(/[\/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit filename length
}

// Sanitize email for use in directory path (consistent with fallbackStorageService)
export function sanitizeEmailForPath(email: string): string {
  return email
    .toLowerCase()
    .replace(/@/g, '_at_')
    .replace(/\+/g, '')
    .replace(/\./g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .substring(0, 100);
}