import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Worker Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('should load default config when no env vars are set', () => {
    process.env = {};
    jest.resetModules();

    const { workerConfig } = require('../../src/core/config');

    expect(workerConfig.env).toBe('development');
    expect(workerConfig.postgres.host).toBe('localhost');
    expect(workerConfig.postgres.port).toBe(5432);
    expect(workerConfig.postgres.database).toBe('ecards_db');
    expect(workerConfig.postgres.user).toBe('ecards_user');
    expect(workerConfig.postgres.password).toBe('');
    expect(workerConfig.redis.host).toBe('localhost');
    expect(workerConfig.redis.port).toBe(6379);
    expect(workerConfig.seaweedfs.endpoint).toBe('');
    expect(workerConfig.seaweedfs.accessKey).toBe('');
    expect(workerConfig.seaweedfs.secretKey).toBe('');
    expect(workerConfig.seaweedfs.bucket).toBe('');
    expect(workerConfig.worker.concurrency).toBe(4);
    expect(workerConfig.worker.maxAttempts).toBe(3);
    expect(workerConfig.worker.timeout).toBe(60000);
    expect(workerConfig.worker.renderEngine).toBe('canvas');
  });

  it('should load custom config from environment variables', () => {
    process.env.NODE_ENV = 'production';
    process.env.POSTGRES_HOST = 'db.example.com';
    process.env.POSTGRES_PORT = '5433';
    process.env.POSTGRES_DB = 'worker_db';
    process.env.POSTGRES_USER = 'worker_user';
    process.env.POSTGRES_PASSWORD = 'worker_pass';
    process.env.REDIS_HOST = 'redis.example.com';
    process.env.REDIS_PORT = '6380';
    process.env.SEAWEEDFS_ENDPOINT = 'https://storage.example.com';
    process.env.SEAWEEDFS_ACCESS_KEY = 'access_key';
    process.env.SEAWEEDFS_SECRET_KEY = 'secret_key';
    process.env.SEAWEEDFS_BUCKET = 'rendered-cards';
    process.env.WORKER_CONCURRENCY = '8';
    process.env.WORKER_MAX_ATTEMPTS = '5';
    process.env.WORKER_TIMEOUT = '120000';
    process.env.RENDER_ENGINE = 'sharp';

    const { workerConfig } = require('../../src/core/config');

    expect(workerConfig.env).toBe('production');
    expect(workerConfig.postgres.host).toBe('db.example.com');
    expect(workerConfig.postgres.port).toBe(5433);
    expect(workerConfig.postgres.database).toBe('worker_db');
    expect(workerConfig.postgres.user).toBe('worker_user');
    expect(workerConfig.postgres.password).toBe('worker_pass');
    expect(workerConfig.redis.host).toBe('redis.example.com');
    expect(workerConfig.redis.port).toBe(6380);
    expect(workerConfig.seaweedfs.endpoint).toBe('https://storage.example.com');
    expect(workerConfig.seaweedfs.accessKey).toBe('access_key');
    expect(workerConfig.seaweedfs.secretKey).toBe('secret_key');
    expect(workerConfig.seaweedfs.bucket).toBe('rendered-cards');
    expect(workerConfig.worker.concurrency).toBe(8);
    expect(workerConfig.worker.maxAttempts).toBe(5);
    expect(workerConfig.worker.timeout).toBe(120000);
    expect(workerConfig.worker.renderEngine).toBe('sharp');
  });

  it('should parse port numbers correctly', () => {
    process.env.POSTGRES_PORT = '5432';
    process.env.REDIS_PORT = '6379';
    process.env.WORKER_CONCURRENCY = '1';
    process.env.WORKER_MAX_ATTEMPTS = '1';
    process.env.WORKER_TIMEOUT = '1000';

    jest.resetModules();
    const { workerConfig } = require('../../src/core/config');

    expect(workerConfig.postgres.port).toBe(5432);
    expect(workerConfig.redis.port).toBe(6379);
    expect(workerConfig.worker.concurrency).toBe(1);
    expect(workerConfig.worker.maxAttempts).toBe(1);
    expect(workerConfig.worker.timeout).toBe(1000);
  });

  it('should use empty string defaults for seaweedfs', () => {
    delete process.env.SEAWEEDFS_ENDPOINT;
    delete process.env.SEAWEEDFS_ACCESS_KEY;
    delete process.env.SEAWEEDFS_SECRET_KEY;
    delete process.env.SEAWEEDFS_BUCKET;

    jest.resetModules();
    const { workerConfig } = require('../../src/core/config');

    expect(workerConfig.seaweedfs.endpoint).toBe('');
    expect(workerConfig.seaweedfs.accessKey).toBe('');
    expect(workerConfig.seaweedfs.secretKey).toBe('');
    expect(workerConfig.seaweedfs.bucket).toBe('');
  });
});
