/**
 * Pass 4 — template kind ('template' | 'design') route tests.
 * The unified storage service is mocked (its source file carries 2 pre-existing
 * tsc errors that ts-jest cannot compile); persistence/filter details are covered
 * by templateKindOperations.test.ts against templateOperations directly.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';

const mockSaveTemplate: any = jest.fn();
const mockListTemplates: any = jest.fn();

jest.mock('../../../src/features/template-textile/services/unifiedTemplateStorageService', () => ({
  unifiedTemplateStorageService: {
    saveTemplate: (...args: unknown[]) => mockSaveTemplate(...args),
    listTemplates: (...args: unknown[]) => mockListTemplates(...args),
    loadTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
  },
}));

jest.mock('../../../src/features/template-textile/services/modeDetectionService', () => ({
  modeDetectionService: { detectMode: jest.fn(async () => ({ mode: 'fallback' })) },
}));

jest.mock('../../../src/features/template-textile/services/resourceDeduplicationService', () => ({
  resourceDeduplicationService: { storeResource: jest.fn() },
}));

jest.mock('../../../src/features/template-textile/controllers/resourceProxyController', () => ({
  resourceProxyController: { getResource: jest.fn() },
}));

const USER = { id: 'user-1', email: 'user@example.com' };

jest.mock('../../../src/core/middleware/authMiddleware', () => ({
  requireAuth: jest.fn(async (request: any) => {
    request.user = USER;
  }),
}));

// eslint-disable-next-line import/first
import templateRoutes from '../../../src/features/template-textile/routes/templateRoutes';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(templateRoutes);
  return app;
}

const SAVE_BODY = {
  name: 'Base Card',
  templateData: { width: 1000, height: 600, elements: [] },
};

const SAVED_METADATA = {
  id: 'tpl-new',
  userId: USER.id,
  name: 'Base Card',
  storageUrl: 'fallback:///x',
  storageMode: 'fallback',
  resourceUrls: [],
  version: 1,
  kind: 'template',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('template-textile routes — kind (Pass 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveTemplate.mockResolvedValue(SAVED_METADATA);
    mockListTemplates.mockResolvedValue([]);
  });

  describe('POST /api/v1/template-textile', () => {
    it('forwards an explicit kind to the storage service', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/template-textile',
        payload: { ...SAVE_BODY, kind: 'template' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.kind).toBe('template');
      expect(mockSaveTemplate).toHaveBeenCalledTimes(1);
      expect(mockSaveTemplate.mock.calls[0][0]).toMatchObject({
        name: 'Base Card',
        kind: 'template',
      });
      await app.close();
    });

    it('omits kind when not provided (default design behavior unchanged)', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/template-textile',
        payload: SAVE_BODY,
      });

      expect(response.statusCode).toBe(200);
      expect(mockSaveTemplate.mock.calls[0][0].kind).toBeUndefined();
      await app.close();
    });

    it('rejects an invalid kind with 400', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/template-textile',
        payload: { ...SAVE_BODY, kind: 'bogus' },
      });

      expect(response.statusCode).toBe(400);
      expect(mockSaveTemplate).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('GET /api/v1/template-textile?kind=', () => {
    it('accepts kind=template and reaches the storage service with the query intact', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/template-textile?kind=template',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(mockListTemplates).toHaveBeenCalledTimes(1);
      const passedRequest = mockListTemplates.mock.calls[0][0] as any;
      expect(passedRequest.query).toMatchObject({ kind: 'template' });
      await app.close();
    });

    it('accepts the list without a kind filter (existing behavior unchanged)', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/template-textile',
      });

      expect(response.statusCode).toBe(200);
      expect(mockListTemplates).toHaveBeenCalledTimes(1);
      await app.close();
    });

    it('rejects an invalid kind filter with 400', async () => {
      const app = await buildApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/template-textile?kind=bogus',
      });

      expect(response.statusCode).toBe(400);
      expect(mockListTemplates).not.toHaveBeenCalled();
      await app.close();
    });
  });
});
