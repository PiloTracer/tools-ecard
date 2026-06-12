import { describe, it, expect } from '@jest/globals';
import { BatchUploadError } from '../../../src/features/batch-upload/types';
import { BatchStatus } from '@prisma/client';

describe('BatchUpload Types and Errors', () => {
  describe('BatchUploadError', () => {
    it('should create error with default status code', () => {
      const error = new BatchUploadError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('BatchUploadError');
    });

    it('should create error with custom status code', () => {
      const error = new BatchUploadError('Not found', 'NOT_FOUND', 404);
      expect(error.statusCode).toBe(404);
    });

    it('should create error with 500 status code', () => {
      const error = new BatchUploadError('Server error', 'INTERNAL', 500);
      expect(error.statusCode).toBe(500);
    });
  });

  describe('BatchStatus values', () => {
    it('should have correct status enum values', () => {
      expect(BatchStatus.UPLOADED).toBe('UPLOADED');
      expect(BatchStatus.PARSING).toBe('PARSING');
      expect(BatchStatus.PARSED).toBe('PARSED');
      expect(BatchStatus.LOADED).toBe('LOADED');
      expect(BatchStatus.ERROR).toBe('ERROR');
    });
  });

  describe('Constants', () => {
    it('should have correct allowed file types', () => {
      const { ALLOWED_FILE_TYPES } = require('../../../src/features/batch-upload/types');
      expect(ALLOWED_FILE_TYPES).toContain('.csv');
      expect(ALLOWED_FILE_TYPES).toContain('.txt');
      expect(ALLOWED_FILE_TYPES).toContain('.vcf');
      expect(ALLOWED_FILE_TYPES).toContain('.xls');
      expect(ALLOWED_FILE_TYPES).toContain('.xlsx');
    });

    it('should have correct max file size', () => {
      const { MAX_FILE_SIZE } = require('../../../src/features/batch-upload/types');
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('should have correct queue names', () => {
      const { BATCH_UPLOAD_QUEUE, BATCH_PARSE_QUEUE } = require('../../../src/features/batch-upload/types');
      expect(BATCH_UPLOAD_QUEUE).toBe('batch-upload-queue');
      expect(BATCH_PARSE_QUEUE).toBe('batch-parse-queue');
    });
  });
});
