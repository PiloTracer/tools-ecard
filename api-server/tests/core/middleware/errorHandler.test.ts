import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { errorHandler } from '../../../src/core/middleware/errorHandler';

describe('Error Handler Middleware', () => {
  const mockReply = () => {
    const statusCode = { value: 200 };
    const sent = { value: null };
    return {
      status: jest.fn((code: number) => {
        statusCode.value = code;
        return { send: jest.fn((data: any) => { sent.value = data; }) };
      }),
      getStatusCode: () => statusCode.value,
      getSent: () => sent.value,
    };
  };

  const mockRequest = () => ({
    method: 'GET',
    url: '/api/test',
  });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle errors with status code', async () => {
    const reply = mockReply();
    const request = mockRequest() as any;
    const error = { message: 'Bad Request', statusCode: 400, code: 'BAD_REQUEST', stack: 'stack' } as any;

    await errorHandler(error, request, reply as any);

    expect(reply.getStatusCode()).toBe(400);
    expect(reply.getSent()).toEqual({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Bad Request',
      },
    });
  });

  it('should handle errors without status code (default 500)', async () => {
    const reply = mockReply();
    const request = mockRequest() as any;
    const error = { message: 'Something broke', code: 'INTERNAL_ERROR', stack: 'stack' } as any;

    await errorHandler(error, request, reply as any);

    expect(reply.getStatusCode()).toBe(500);
    expect(reply.getSent()).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something broke',
      },
    });
  });

  it('should handle errors without code or message', async () => {
    const reply = mockReply();
    const request = mockRequest() as any;
    const error = {} as any;

    await errorHandler(error, request, reply as any);

    expect(reply.getStatusCode()).toBe(500);
    expect(reply.getSent()).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('should log error details', async () => {
    const reply = mockReply();
    const request = mockRequest() as any;
    const error = { message: 'Test Error', statusCode: 404, code: 'NOT_FOUND', stack: 'test-stack' } as any;

    await errorHandler(error, request, reply as any);

    expect(console.error).toHaveBeenCalledWith('Error:', {
      method: 'GET',
      url: '/api/test',
      error: 'Test Error',
      stack: 'test-stack',
    });
  });
});
