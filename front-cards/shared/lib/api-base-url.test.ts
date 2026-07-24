import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('API Base URL', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('should return default URL when no env var is set', () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('http://localhost:7400');
  });

  it('should return URL from env var', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('should strip trailing slashes', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('should strip multiple trailing slashes', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com///';
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('should handle URL with path', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/v1/';
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('https://api.example.com/v1');
  });

  it('should handle whitespace in env var', () => {
    process.env.NEXT_PUBLIC_API_URL = '  https://api.example.com  ';
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('should handle empty string env var', () => {
    process.env.NEXT_PUBLIC_API_URL = '';
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('http://localhost:7400');
  });

  it('should handle URL with port', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8080';
    const { getApiBaseUrl } = require('./api-base-url');
    expect(getApiBaseUrl()).toBe('http://localhost:8080');
  });
});
