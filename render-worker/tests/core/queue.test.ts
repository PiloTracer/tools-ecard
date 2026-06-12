import { describe, it, expect, jest } from '@jest/globals';

// Mock bullmq before importing the module
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name, options) => ({
    name,
    options,
  })),
}));

jest.mock('../../src/core/config', () => ({
  workerConfig: {
    redis: {
      host: 'localhost',
      port: 6379,
    },
  },
}));

describe('Queue Module', () => {
  it('should export renderQueue', () => {
    const { renderQueue } = require('../../src/core/queue');
    expect(renderQueue).toBeDefined();
    expect(renderQueue.name).toBe('card-rendering');
  });

  it('should configure queue with redis connection', () => {
    const { renderQueue } = require('../../src/core/queue');
    expect(renderQueue.options.connection).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });
});
