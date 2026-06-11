/**
 * Storage service tests
 * Tests for S3 key generation and URL building (no native deps required)
 */

// Mock the workerConfig since storage.ts imports it
jest.mock('../src/core/config', () => ({
  workerConfig: {
    seaweedfs: {
      endpoint: 'http://seaweedfs:8333',
      accessKey: 'test_key',
      secretKey: 'test_secret',
      bucket: 'ecards-rendered',
    },
  },
}));

// Mock AWS SDK to avoid dynamic import issues in Jest
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ ETag: '"test-etag"' }),
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
}));

// Require after mock so the mock is applied before the module under test loads
const { buildCardStorageKey, buildCardUrl } = require('../src/services/storage');

describe('buildCardStorageKey', () => {
  it('should generate key with batchId and recordId', () => {
    const key = buildCardStorageKey('batch-123', 'record-456');
    expect(key).toBe('rendered/batch-123/record-456.png');
  });

  it('should handle special characters in IDs', () => {
    const key = buildCardStorageKey('batch/1', 'record:2');
    expect(key).toBe('rendered/batch/1/record:2.png');
  });
});

describe('buildCardUrl', () => {
  it('should generate correct S3 URL', () => {
    const url = buildCardUrl('ecards-rendered', 'rendered/batch-1/record-1.png');
    expect(url).toBe('http://seaweedfs:8333/ecards-rendered/rendered/batch-1/record-1.png');
  });
});

describe('uploadToStorage', () => {
  it('should upload a buffer and return key and bucket', async () => {
    const { uploadToStorage } = require('../src/services/storage');
    const result = await uploadToStorage({
      key: 'rendered/batch-1/record-1.png',
      body: Buffer.from('test'),
      contentType: 'image/png',
    });
    expect(result.key).toBe('rendered/batch-1/record-1.png');
    expect(result.bucket).toBe('ecards-rendered');
    expect(result.etag).toBeDefined();
  });
});
