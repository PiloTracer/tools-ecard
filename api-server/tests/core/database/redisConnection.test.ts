import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('Redis connection options', () => {
  const envKeys = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    envKeys.forEach((key) => {
      original[key] = process.env[key];
    });
    jest.resetModules();
  });

  afterEach(() => {
    envKeys.forEach((key) => {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    });
    jest.resetModules();
  });

  it('includes password when REDIS_PASSWORD is set', () => {
    process.env.REDIS_HOST = 'redis';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'secret';

    const { getRedisConnectionOptions } = require('../../../src/core/database/redisConnection');
    expect(getRedisConnectionOptions()).toEqual({
      host: 'redis',
      port: 6379,
      password: 'secret',
    });
  });

  it('omits password when REDIS_PASSWORD is empty', () => {
    process.env.REDIS_HOST = 'redis';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = '';

    const { getRedisConnectionOptions } = require('../../../src/core/database/redisConnection');
    expect(getRedisConnectionOptions()).toEqual({
      host: 'redis',
      port: 6379,
    });
  });
});
