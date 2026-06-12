import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { loadS3Config, getObjectKey, parseS3Url, DEFAULT_BUCKETS } from '../../../src/features/s3-bucket/config/s3Config';

describe('S3 Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('loadS3Config', () => {
    it('should load with default values when env vars are not set', () => {
      delete process.env.SEAWEEDFS_ENDPOINT;
      delete process.env.SEAWEEDFS_ACCESS_KEY;
      delete process.env.SEAWEEDFS_SECRET_KEY;

      const config = loadS3Config();

      expect(config.endpoint).toBe('http://localhost:8333');
      expect(config.region).toBe('us-east-1');
      expect(config.bucket).toBe('repositories');
      expect(config.forcePathStyle).toBe(true);
      expect(config.signatureVersion).toBe('v4');
      expect(config.maxFileSize).toBe(104857600);
      expect(config.multipartThreshold).toBe(10485760);
      expect(config.allowedMimeTypes).toContain('image/png');
      expect(config.allowedMimeTypes).toContain('application/pdf');
    });

    it('should load custom config from environment variables', () => {
      process.env.SEAWEEDFS_ENDPOINT = 'https://s3.example.com';
      process.env.SEAWEEDFS_ACCESS_KEY = 'my_access_key';
      process.env.SEAWEEDFS_SECRET_KEY = 'my_secret_key';
      process.env.SEAWEEDFS_REGION = 'eu-west-1';
      process.env.SEAWEEDFS_BUCKET = 'my_bucket';
      process.env.STORAGE_MAX_FILE_SIZE = '209715200';
      process.env.STORAGE_MULTIPART_THRESHOLD = '20971520';
      process.env.STORAGE_ALLOWED_TYPES = 'image/png,image/jpeg,application/json';

      const config = loadS3Config();

      expect(config.endpoint).toBe('https://s3.example.com');
      expect(config.accessKey).toBe('my_access_key');
      expect(config.secretKey).toBe('my_secret_key');
      expect(config.region).toBe('eu-west-1');
      expect(config.bucket).toBe('my_bucket');
      expect(config.maxFileSize).toBe(209715200);
      expect(config.multipartThreshold).toBe(20971520);
      expect(config.allowedMimeTypes).toEqual(['image/png', 'image/jpeg', 'application/json']);
    });

    it('should use default access key when env var is not set', () => {
      delete process.env.SEAWEEDFS_ACCESS_KEY;
      const config = loadS3Config();
      expect(config.accessKey).toBe('your_seaweedfs_access_key');
    });
  });

  describe('DEFAULT_BUCKETS', () => {
    it('should have the correct bucket names', () => {
      expect(DEFAULT_BUCKETS.TEMPLATES).toBe('templates');
      expect(DEFAULT_BUCKETS.USERS).toBe('users');
      expect(DEFAULT_BUCKETS.BATCHES).toBe('batches');
      expect(DEFAULT_BUCKETS.APPLICATION).toBe('application');
    });
  });

  describe('getObjectKey', () => {
    it('should join parts with forward slashes', () => {
      expect(getObjectKey('bucket', 'folder', 'file.txt')).toBe('folder/file.txt');
    });

    it('should filter out falsy values', () => {
      expect(getObjectKey('bucket', 'folder', '', 'file.txt')).toBe('folder/file.txt');
      expect(getObjectKey('bucket', null as any, 'file.txt')).toBe('file.txt');
    });

    it('should handle single part', () => {
      expect(getObjectKey('bucket', 'file.txt')).toBe('file.txt');
    });

    it('should handle empty parts', () => {
      expect(getObjectKey('bucket')).toBe('');
    });
  });

  describe('parseS3Url', () => {
    it('should parse s3:// URLs', () => {
      const result = parseS3Url('s3://my-bucket/path/to/file.txt');
      expect(result).toEqual({ bucket: 'my-bucket', key: 'path/to/file.txt' });
    });

    it('should parse HTTP URLs with /storage/ pattern', () => {
      const result = parseS3Url('https://example.com/storage/my-bucket/path/to/file.txt');
      expect(result).toEqual({ bucket: 'my-bucket', key: 'path/to/file.txt' });
    });

    it('should return null for unparseable URLs', () => {
      expect(parseS3Url('https://example.com/other/path')).toBeNull();
      expect(parseS3Url('not-a-url')).toBeNull();
      expect(parseS3Url('')).toBeNull();
    });
  });
});
