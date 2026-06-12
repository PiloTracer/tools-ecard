import { describe, it, expect } from '@jest/globals';
import {
  uploadFileSchema,
  getBatchStatusSchema,
  listBatchesSchema,
  deleteBatchSchema,
  sanitizeFileName,
  sanitizeEmailForPath,
} from '../../../src/features/batch-upload/validators/batchValidators';

describe('Batch Upload Validators', () => {
  describe('uploadFileSchema', () => {
    it('should validate valid file upload', () => {
      const result = uploadFileSchema.safeParse({
        file: {
          fieldname: 'file',
          originalname: 'test.csv',
          encoding: '7bit',
          mimetype: 'text/csv',
          size: 1024,
          buffer: Buffer.from('test'),
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject file with invalid extension', () => {
      const result = uploadFileSchema.safeParse({
        file: {
          fieldname: 'file',
          originalname: 'test.exe',
          encoding: '7bit',
          mimetype: 'application/x-msdownload',
          size: 1024,
          buffer: Buffer.from('test'),
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject file exceeding max size', () => {
      const result = uploadFileSchema.safeParse({
        file: {
          fieldname: 'file',
          originalname: 'test.csv',
          encoding: '7bit',
          mimetype: 'text/csv',
          size: 11 * 1024 * 1024,
          buffer: Buffer.from('test'),
        },
      });
      expect(result.success).toBe(false);
    });

    it('should accept .xlsx files', () => {
      const result = uploadFileSchema.safeParse({
        file: {
          fieldname: 'file',
          originalname: 'test.xlsx',
          encoding: '7bit',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024,
          buffer: Buffer.from('test'),
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept .vcf files', () => {
      const result = uploadFileSchema.safeParse({
        file: {
          fieldname: 'file',
          originalname: 'contacts.vcf',
          encoding: '7bit',
          mimetype: 'text/vcard',
          size: 1024,
          buffer: Buffer.from('test'),
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getBatchStatusSchema', () => {
    it('should validate valid UUID', () => {
      const result = getBatchStatusSchema.safeParse({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = getBatchStatusSchema.safeParse({
        params: { id: 'not-a-uuid' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('listBatchesSchema', () => {
    it('should validate empty query', () => {
      const result = listBatchesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate with valid page and limit', () => {
      const result = listBatchesSchema.safeParse({
        query: { page: '1', limit: '20' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid page', () => {
      const result = listBatchesSchema.safeParse({
        query: { page: '0' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = listBatchesSchema.safeParse({
        query: { limit: '101' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const result = listBatchesSchema.safeParse({
        query: { limit: '-1' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteBatchSchema', () => {
    it('should validate valid UUID', () => {
      const result = deleteBatchSchema.safeParse({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = deleteBatchSchema.safeParse({
        params: { id: 'invalid' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove path separators', () => {
      expect(sanitizeFileName('path/to/file.txt')).toBe('path_to_file.txt');
      expect(sanitizeFileName('path\\to\\file.txt')).toBe('path_to_file.txt');
    });

    it('should remove parent directory references', () => {
      expect(sanitizeFileName('../../../etc/passwd')).toBe('______etc_passwd');
    });

    it('should replace special characters with underscores', () => {
      expect(sanitizeFileName('file@#$%.txt')).toBe('file____.txt');
    });

    it('should limit filename length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt';
      expect(sanitizeFileName(longName).length).toBe(255);
    });

    it('should preserve safe characters', () => {
      expect(sanitizeFileName('file-name_123.txt')).toBe('file-name_123.txt');
    });
  });

  describe('sanitizeEmailForPath', () => {
    it('should convert email to safe directory name', () => {
      expect(sanitizeEmailForPath('john.doe@example.com')).toBe('john_doe_at_example_com');
    });

    it('should handle plus signs in email', () => {
      expect(sanitizeEmailForPath('user+tag@example.com')).toBe('usertag_at_example_com');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeEmailForPath('John.Doe@EXAMPLE.COM')).toBe('john_doe_at_example_com');
    });

    it('should limit length to 100 characters', () => {
      const longEmail = 'a'.repeat(200) + '@example.com';
      expect(sanitizeEmailForPath(longEmail).length).toBe(100);
    });

    it('should handle complex emails', () => {
      expect(sanitizeEmailForPath('john.doe+test@sub.domain.co.uk')).toBe('john_doetest_at_sub_domain_co_uk');
    });
  });
});
