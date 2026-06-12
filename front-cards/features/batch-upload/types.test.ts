import { describe, it, expect } from '@jest/globals';
import {
  BatchStatus,
  Batch,
  BatchUploadResponse,
  BatchStatusResponse,
  ListBatchesResponse,
  BatchStats,
  FileUploadProps,
  BatchStatusTrackerProps,
  FileValidationError,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
} from './types';

describe('Batch Upload Types', () => {
  it('should have correct BatchStatus enum values', () => {
    expect(BatchStatus.UPLOADED).toBe('UPLOADED');
    expect(BatchStatus.PARSING).toBe('PARSING');
    expect(BatchStatus.PARSED).toBe('PARSED');
    expect(BatchStatus.LOADED).toBe('LOADED');
    expect(BatchStatus.ERROR).toBe('ERROR');
  });

  it('should create a valid Batch object', () => {
    const batch: Batch = {
      id: 'batch-123',
      fileName: 'contacts.csv',
      fileSize: 1024,
      status: BatchStatus.UPLOADED,
      errorMessage: null,
      progress: 20,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      processedAt: null,
    };

    expect(batch.id).toBe('batch-123');
    expect(batch.fileName).toBe('contacts.csv');
    expect(batch.status).toBe(BatchStatus.UPLOADED);
  });

  it('should create a valid BatchUploadResponse', () => {
    const response: BatchUploadResponse = {
      id: 'batch-123',
      status: BatchStatus.UPLOADED,
      message: 'File uploaded successfully',
    };

    expect(response.id).toBe('batch-123');
    expect(response.message).toBe('File uploaded successfully');
  });

  it('should create a valid BatchStatusResponse', () => {
    const response: BatchStatusResponse = {
      id: 'batch-123',
      status: BatchStatus.PARSING,
      progress: 40,
      errorMessage: null,
      fileName: 'contacts.csv',
      fileSize: 1024,
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null,
    };

    expect(response.progress).toBe(40);
  });

  it('should create a valid ListBatchesResponse', () => {
    const response: ListBatchesResponse = {
      batches: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    expect(response.total).toBe(0);
  });

  it('should create a valid BatchStats object', () => {
    const stats: BatchStats = {
      total: 10,
      uploaded: 2,
      parsing: 1,
      parsed: 5,
      loaded: 2,
      error: 0,
    };

    expect(stats.total).toBe(10);
    expect(stats.loaded).toBe(2);
  });

  it('should create a valid FileUploadProps', () => {
    const props: FileUploadProps = {
      onSuccess: jest.fn(),
      onError: jest.fn(),
      acceptedFileTypes: ['.csv'],
      maxFileSize: 1024,
      className: 'upload-component',
    };

    expect(props.className).toBe('upload-component');
  });

  it('should create a valid BatchStatusTrackerProps', () => {
    const props: BatchStatusTrackerProps = {
      batchId: 'batch-123',
      onComplete: jest.fn(),
      onError: jest.fn(),
      className: 'tracker',
    };

    expect(props.batchId).toBe('batch-123');
  });

  it('should create a valid FileValidationError', () => {
    const error: FileValidationError = {
      type: 'size',
      message: 'File too large',
    };

    expect(error.type).toBe('size');
  });

  it('should have correct file extension constants', () => {
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.csv');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.txt');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.vcf');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.xls');
    expect(ALLOWED_FILE_EXTENSIONS).toContain('.xlsx');
    expect(ALLOWED_FILE_EXTENSIONS).toHaveLength(5);
  });

  it('should have correct file size constants', () => {
    expect(MAX_FILE_SIZE_MB).toBe(10);
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
