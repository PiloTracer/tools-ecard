import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { oauthServerFetch } from '../../src/core/oauthFetch';
import * as http from 'node:http';
import * as https from 'node:https';

describe('oauthServerFetch', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const mockResponse = () => ({ ok: true, json: async () => ({}) }) as any;

  it('should use standard fetch in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch('https://example.com/api', { method: 'GET' });

    expect(fetchFn).toHaveBeenCalledWith('https://example.com/api', { method: 'GET' });
  });

  it('should use standard fetch when OAUTH_DEV_INSECURE_TLS is false', async () => {
    process.env.NODE_ENV = 'development';
    process.env.OAUTH_DEV_INSECURE_TLS = 'false';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch('https://example.com/api', { method: 'GET' });

    expect(fetchFn).toHaveBeenCalledWith('https://example.com/api', { method: 'GET' });
  });

  it('should use standard fetch for non-HTTP protocols', async () => {
    process.env.NODE_ENV = 'development';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch('ftp://example.com/file', { method: 'GET' });

    expect(fetchFn).toHaveBeenCalledWith('ftp://example.com/file', { method: 'GET' });
  });

  it('should use standard fetch for non-string body', async () => {
    process.env.NODE_ENV = 'development';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch('https://example.com/api', { method: 'POST', body: new FormData() as any });

    expect(fetchFn).toHaveBeenCalledWith('https://example.com/api', { method: 'POST', body: expect.anything() });
  });

  it('should handle URL object input', async () => {
    process.env.NODE_ENV = 'production';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch(new URL('https://example.com/api'), { method: 'GET' });

    expect(fetchFn).toHaveBeenCalledWith(new URL('https://example.com/api'), { method: 'GET' });
  });

  it('should handle URLSearchParams body', async () => {
    process.env.NODE_ENV = 'production';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    const params = new URLSearchParams({ key: 'value' });
    await oauthServerFetch('https://example.com/api', { method: 'POST', body: params });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ method: 'POST', body: params })
    );
  });

  it('should handle Headers object', async () => {
    process.env.NODE_ENV = 'production';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    const headers = new Headers({ 'X-Custom': 'value' });
    await oauthServerFetch('https://example.com/api', { method: 'GET', headers });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ method: 'GET', headers })
    );
  });

  it('should handle plain object headers', async () => {
    process.env.NODE_ENV = 'production';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch('https://example.com/api', { method: 'GET', headers: { 'X-Custom': 'value' } });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ method: 'GET', headers: { 'X-Custom': 'value' } })
    );
  });

  it('should handle array headers', async () => {
    process.env.NODE_ENV = 'production';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch('https://example.com/api', { method: 'GET', headers: [['X-Custom', 'value']] as any });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ method: 'GET', headers: [['X-Custom', 'value']] })
    );
  });

  it('should handle GET with no body', async () => {
    process.env.NODE_ENV = 'production';
    const fetchFn = jest.fn(() => Promise.resolve(mockResponse()));
    (global as any).fetch = fetchFn;

    await oauthServerFetch('https://example.com/api');

    expect(fetchFn).toHaveBeenCalledWith('https://example.com/api', undefined);
  });
});
