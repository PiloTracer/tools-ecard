import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockProjectFindUnique: any = jest.fn();
const mockBatchCreate: any = jest.fn();
const mockFindByUserIdAndId: any = jest.fn();
const mockUpdateStatus: any = jest.fn();
const mockUploadBatchFile: any = jest.fn();
const mockEnqueue: any = jest.fn();

jest.mock('../../../src/core/database/prisma', () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
    },
  },
}));

jest.mock('../../../src/features/batch-upload/repositories/batchRepository', () => ({
  batchRepository: {
    create: (...args: unknown[]) => mockBatchCreate(...args),
    findByUserIdAndId: (...args: unknown[]) => mockFindByUserIdAndId(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  },
}));

jest.mock('../../../src/features/batch-upload/services/storageService', () => ({
  storageService: {
    uploadBatchFile: (...args: unknown[]) => mockUploadBatchFile(...args),
    deleteFile: jest.fn(),
  },
}));

jest.mock('../../../src/features/batch-upload/services/queueService', () => ({
  queueService: {
    enqueueBatchParsing: (...args: unknown[]) => mockEnqueue(...args),
  },
}));

jest.mock('../../../src/features/batch-parsing/repositories/batchRecordRepository', () => ({
  batchRecordRepository: {
    getRecordCountByBatchId: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import { batchUploadService } from '../../../src/features/batch-upload/services/batchUploadService';
// eslint-disable-next-line import/first
import { BatchStatus } from '@prisma/client';

const MAPPING = [
  { sourceColumn: 'E Mail', targetField: 'email' },
  { sourceColumn: 'Employee ID', targetField: 'ignore' },
];

const FILE = {
  originalname: 'contacts.csv',
  size: 128,
  buffer: Buffer.from('x'),
} as Express.Multer.File;

describe('BatchUploadService mapping threading (Pass 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectFindUnique.mockResolvedValue({
      workPhonePrefix: '2222',
      defaultCountryCode: '+(506)',
    });
    mockUploadBatchFile.mockResolvedValue({ filePath: 'batches/a/p/contacts.csv', url: 'u', size: 1 });
    mockBatchCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve({ id: 'batch-1', status: BatchStatus.UPLOADED, ...data })
    );
    mockEnqueue.mockResolvedValue('job-1');
  });

  it('persists the explicit mapping on the batch and enqueues it with the job', async () => {
    await batchUploadService.uploadBatch({
      file: FILE,
      userId: 'user-a',
      userEmail: 'a@example.com',
      projectId: 'proj-1',
      projectName: 'Default',
      batchRecordLimit: -1,
      mapping: MAPPING,
    });

    expect(mockBatchCreate.mock.calls[0][0].fieldMapping).toEqual(MAPPING);
    const job = mockEnqueue.mock.calls[0][0];
    expect(job.mapping).toEqual(MAPPING);
    expect(job.batchId).toBe('batch-1');
  });

  it('omits the mapping entirely when none is given (backwards compatible)', async () => {
    await batchUploadService.uploadBatch({
      file: FILE,
      userId: 'user-a',
      userEmail: 'a@example.com',
      projectId: 'proj-1',
      projectName: 'Default',
      batchRecordLimit: -1,
    });

    expect(mockBatchCreate.mock.calls[0][0].fieldMapping).toBeUndefined();
    expect(mockEnqueue.mock.calls[0][0].mapping).toBeUndefined();
  });

  it('retry re-attaches the mapping persisted on the batch', async () => {
    mockFindByUserIdAndId.mockResolvedValue({
      id: 'batch-1',
      userId: 'user-a',
      status: BatchStatus.ERROR,
      filePath: 'batches/a/p/contacts.csv',
      userEmail: 'a@example.com',
      projectId: 'proj-1',
      fieldMapping: MAPPING,
    });
    mockUpdateStatus.mockResolvedValue({});

    await batchUploadService.retryBatch('user-a', 'batch-1', -1);

    expect(mockEnqueue.mock.calls[0][0].mapping).toEqual(MAPPING);
  });
});
