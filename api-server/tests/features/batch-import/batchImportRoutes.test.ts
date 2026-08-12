import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';

const mockFindFirst: any = jest.fn();
const mockFindMany: any = jest.fn();
const mockCreate: any = jest.fn();
const mockDeleteMany: any = jest.fn();
const mockInspectFile: any = jest.fn();

jest.mock('../../../src/core/prisma/client', () => ({
  prisma: {
    fieldMappingPreset: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

jest.mock('../../../src/features/batch-parsing/services/batchParsingService', () => {
  const actual = jest.requireActual(
    '../../../src/features/batch-parsing/services/batchParsingService'
  ) as Record<string, unknown>;
  return {
    ...actual,
    batchParsingService: {
      inspectFile: (...args: unknown[]) => mockInspectFile(...args),
    },
  };
});

// eslint-disable-next-line import/first
import { batchImportRoutes } from '../../../src/features/batch-import/routes.fastify';

const USER_A = { id: 'user-a', email: 'a@example.com' };
const USER_B = { id: 'user-b', email: 'b@example.com' };

async function buildApp(user: { id: string; email: string } | null): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(fastifyMultipart);
  app.addHook('preHandler', async (request) => {
    (request as { user?: unknown }).user = user;
  });
  await app.register(batchImportRoutes, { prefix: '/api/batch-import' });
  return app;
}

function multipartPayload(fieldName: string, filename: string, content: string) {
  const boundary = '----jestboundary';
  const payload = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"`,
    'Content-Type: text/csv',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return {
    payload,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

const INSPECT_RESULT = {
  success: true,
  file: 'contacts.csv',
  rows_total: 2,
  columns: [
    {
      source_column: 'Nombre',
      auto_field: 'first_name',
      confidence: 'alias',
      sample_values: ['Ana Gomez'],
    },
    {
      source_column: 'Employee ID',
      auto_field: null,
      confidence: 'none',
      sample_values: ['EMP-0042'],
    },
  ],
  target_fields: ['email'],
};

describe('batch-import routes (Pass 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/batch-import/preview', () => {
    it('returns per-column analysis, target fields and no preset by default', async () => {
      mockInspectFile.mockResolvedValue(INSPECT_RESULT);
      mockFindFirst.mockResolvedValue(null);
      const app = await buildApp(USER_A);

      const response = await app.inject({
        method: 'POST',
        url: '/api/batch-import/preview',
        ...multipartPayload('file', 'contacts.csv', 'Nombre,Employee ID\nAna Gomez,EMP-0042\n'),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.rowsTotal).toBe(2);
      expect(body.data.columns).toHaveLength(2);
      expect(body.data.columns[1]).toMatchObject({
        sourceColumn: 'Employee ID',
        autoField: null,
        confidence: 'none',
        sampleValues: ['EMP-0042'],
      });
      expect(body.data.targetFields).toHaveLength(30);
      expect(body.data.suggestedPreset).toBeNull();
      await app.close();
    });

    it('suggests the user preset whose signature matches the file headers', async () => {
      mockInspectFile.mockResolvedValue(INSPECT_RESULT);
      mockFindFirst.mockResolvedValue({
        id: 'preset-1',
        userId: 'user-a',
        name: 'HR export',
        signature: 'sig',
        mapping: [{ sourceColumn: 'Employee ID', targetField: 'ignore' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const app = await buildApp(USER_A);

      const response = await app.inject({
        method: 'POST',
        url: '/api/batch-import/preview',
        ...multipartPayload('file', 'contacts.csv', 'x'),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.suggestedPreset).toMatchObject({ id: 'preset-1', name: 'HR export' });
      // Signature lookup is strictly per-user
      expect(mockFindFirst.mock.calls[0][0].where.userId).toBe('user-a');
      await app.close();
    });

    it('requires authentication', async () => {
      const app = await buildApp(null);
      const response = await app.inject({
        method: 'POST',
        url: '/api/batch-import/preview',
        ...multipartPayload('file', 'contacts.csv', 'x'),
      });
      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('returns 400 when the inspect step fails', async () => {
      mockInspectFile.mockResolvedValue({ success: false, error: 'boom' });
      const app = await buildApp(USER_A);
      const response = await app.inject({
        method: 'POST',
        url: '/api/batch-import/preview',
        ...multipartPayload('file', 'contacts.csv', 'x'),
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe('mapping presets CRUD', () => {
    it('creates a preset with a server-computed signature', async () => {
      mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'p1', createdAt: new Date(), updatedAt: new Date(), ...data })
      );
      const app = await buildApp(USER_A);

      const response = await app.inject({
        method: 'POST',
        url: '/api/batch-import/mappings/presets',
        payload: {
          name: 'HR export',
          mapping: [{ sourceColumn: 'Employee ID', targetField: 'ignore' }],
        },
      });

      expect(response.statusCode).toBe(201);
      const createData = mockCreate.mock.calls[0][0].data;
      expect(createData.userId).toBe('user-a');
      expect(createData.name).toBe('HR export');
      expect(typeof createData.signature).toBe('string');
      expect(createData.signature).toHaveLength(8);
      await app.close();
    });

    it('rejects unknown target fields with a 400 listing valid ids', async () => {
      const app = await buildApp(USER_A);
      const response = await app.inject({
        method: 'POST',
        url: '/api/batch-import/mappings/presets',
        payload: {
          name: 'bad',
          mapping: [{ sourceColumn: 'Correo', targetField: 'emial' }],
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('INVALID_MAPPING');
      expect(response.json().error).toContain('email');
      expect(mockCreate).not.toHaveBeenCalled();
      await app.close();
    });

    it('lists presets strictly per-user', async () => {
      mockFindMany.mockResolvedValue([]);
      const app = await buildApp(USER_B);
      const response = await app.inject({
        method: 'GET',
        url: '/api/batch-import/mappings/presets',
      });
      expect(response.statusCode).toBe(200);
      expect(mockFindMany.mock.calls[0][0].where).toEqual({ userId: 'user-b' });
      await app.close();
    });

    it('scopes deletes to the owner and 404s on foreign/missing presets', async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 });
      const app = await buildApp(USER_B);
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/batch-import/mappings/presets/preset-owned-by-a',
      });
      expect(response.statusCode).toBe(404);
      expect(mockDeleteMany.mock.calls[0][0].where).toEqual({
        id: 'preset-owned-by-a',
        userId: 'user-b',
      });
      await app.close();
    });

    it('deletes an owned preset (204)', async () => {
      mockDeleteMany.mockResolvedValue({ count: 1 });
      const app = await buildApp(USER_A);
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/batch-import/mappings/presets/p1',
      });
      expect(response.statusCode).toBe(204);
      await app.close();
    });
  });
});
