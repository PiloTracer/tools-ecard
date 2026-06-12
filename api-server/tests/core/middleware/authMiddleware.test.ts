import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  authMiddleware,
  requireAuth,
  invalidateToken,
} from '../../../src/core/middleware/authMiddleware';

describe('Auth Middleware', () => {
  const mockRequest = (overrides?: any) => ({
    headers: {},
    cookies: {},
    ...overrides,
  });

  const mockReply = () => ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateToken('any');
  });

  describe('authMiddleware', () => {
    it('should proceed as anonymous when no token', async () => {
      const req = mockRequest() as any;
      const reply = mockReply() as any;
      await authMiddleware(req, reply);
      expect(req.user).toBeUndefined();
      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should proceed as anonymous when token is invalid', async () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid_token' },
      }) as any;
      const reply = mockReply() as any;
      await authMiddleware(req, reply);
      expect(req.user).toBeUndefined();
      expect(reply.status).not.toHaveBeenCalled();
    });
  });

  describe('requireAuth', () => {
    it('should return 401 when no token', async () => {
      const req = mockRequest() as any;
      const reply = mockReply() as any;
      await requireAuth(req, reply);
      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 401 when token is invalid', async () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer invalid_token' },
      }) as any;
      const reply = mockReply() as any;
      await requireAuth(req, reply);
      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
      });
    });
  });

  describe('invalidateToken', () => {
    it('should not throw when invalidating non-existent token', () => {
      expect(() => invalidateToken('non_existent')).not.toThrow();
    });
  });
});
