/**
 * Pass 5 — global (isPublic) templates: list merge, load access, and
 * role-gated create/update/delete. Prisma and storage dependencies are
 * mocked; assertions target where-clauses, upsert payloads, and the
 * service-layer immutability guard (defense in depth behind the route gate).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockTemplateUpsert: any = jest.fn();
const mockTemplateFindMany: any = jest.fn();
const mockTemplateCount: any = jest.fn();
const mockTemplateFindFirst: any = jest.fn();
const mockTemplateDelete: any = jest.fn();
const mockProjectUpsert: any = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    templateMetadata: {
      upsert: (...args: unknown[]) => mockTemplateUpsert(...args),
      findMany: (...args: unknown[]) => mockTemplateFindMany(...args),
      count: (...args: unknown[]) => mockTemplateCount(...args),
      findFirst: (...args: unknown[]) => mockTemplateFindFirst(...args),
      delete: (...args: unknown[]) => mockTemplateDelete(...args),
    },
    project: {
      upsert: (...args: unknown[]) => mockProjectUpsert(...args),
      findFirst: jest.fn(),
    },
    templateResource: { create: jest.fn() },
    $disconnect: jest.fn(),
  })),
}));

jest.mock('../../../src/features/template-textile/services/modeDetectionService', () => ({
  modeDetectionService: { detectMode: jest.fn(async () => ({ mode: 'fallback' })) },
}));

jest.mock('../../../src/features/template-textile/services/fallbackStorageService', () => ({
  fallbackStorageService: {
    saveTemplate: jest.fn(async () => 'fb-path'),
    loadTemplate: jest.fn(async () => ({ width: 1000, height: 600, elements: [] })),
    deleteTemplate: jest.fn(async () => undefined),
  },
}));

jest.mock('../../../src/features/template-textile/services/resourceDeduplicationService', () => ({
  resourceDeduplicationService: { storeResource: jest.fn() },
}));

jest.mock('../../../src/core/cassandra/client', () => ({
  cassandraClient: { logTemplateEvent: jest.fn(async () => undefined) },
}));

jest.mock('../../../src/features/s3-bucket/services/s3Service', () => ({
  getS3Service: jest.fn(),
}));

// eslint-disable-next-line import/first
import { templateOperations } from '../../../src/core/prisma/client';
// eslint-disable-next-line import/first
import { unifiedTemplateStorageService } from '../../../src/features/template-textile/services/unifiedTemplateStorageService';
// eslint-disable-next-line import/first
import { GLOBAL_TEMPLATES_AUTHORIZED } from '../../../src/core/middleware/requireAppRole';

const USER = { id: 'user-1', email: 'user-1@example.com' };

function mockRequest(overrides?: any): any {
  return { user: { ...USER }, query: {}, ...overrides };
}

function dbTemplateRow(overrides?: any): any {
  return {
    id: 'tpl-1',
    userId: USER.id,
    projectId: 'proj-1',
    name: 'Base Card',
    storageUrl: 'local://tpl-1',
    storageMode: 'fallback',
    version: 1,
    kind: 'template',
    isPublic: false,
    resources: [],
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...overrides,
  };
}

describe('templateOperations — global list merge (Pass 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplateFindMany.mockResolvedValue([]);
    mockTemplateCount.mockResolvedValue(0);
  });

  it('merges own templates with globals when includeGlobals is set', async () => {
    await templateOperations.listTemplates('user-1', undefined, 1, 20, undefined, true);

    expect(mockTemplateFindMany.mock.calls[0][0].where).toEqual({
      OR: [{ userId: 'user-1' }, { isPublic: true }],
    });
    expect(mockTemplateCount.mock.calls[0][0].where).toEqual({
      OR: [{ userId: 'user-1' }, { isPublic: true }],
    });
  });

  it('keeps the ?kind= filter working on top of the global merge', async () => {
    await templateOperations.listTemplates('user-1', undefined, 1, 20, 'template', true);

    expect(mockTemplateFindMany.mock.calls[0][0].where).toEqual({
      OR: [{ userId: 'user-1' }, { isPublic: true }],
      kind: 'template',
    });
  });

  it('lists only own templates without includeGlobals (existing behavior)', async () => {
    await templateOperations.listTemplates('user-1');

    expect(mockTemplateFindMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
  });
});

describe('unifiedTemplateStorageService — globals (Pass 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectUpsert.mockResolvedValue({ id: 'proj-1', name: 'Default Project' });
    mockTemplateFindMany.mockResolvedValue([]);
    mockTemplateCount.mockResolvedValue(0);
    mockTemplateUpsert.mockResolvedValue({});
    mockTemplateDelete.mockResolvedValue({});
  });

  describe('saveTemplate', () => {
    const input = {
      name: 'Global Card',
      templateData: { width: 1000, height: 600, elements: [] },
      kind: 'template' as const,
      global: true,
    };

    it('rejects a global save without the role-verified flag (403)', async () => {
      await expect(
        unifiedTemplateStorageService.saveTemplate(input, mockRequest())
      ).rejects.toMatchObject({ statusCode: 403, code: 'insufficient_role' });
      expect(mockTemplateUpsert).not.toHaveBeenCalled();
    });

    it('persists isPublic when the request is role-verified', async () => {
      const metadata = await unifiedTemplateStorageService.saveTemplate(
        input,
        mockRequest({ [GLOBAL_TEMPLATES_AUTHORIZED]: true })
      );

      expect(mockTemplateUpsert).toHaveBeenCalledTimes(1);
      const call = mockTemplateUpsert.mock.calls[0][0] as any;
      expect(call.create.isPublic).toBe(true);
      expect(call.update.isPublic).toBe(true);
      expect(metadata.isPublic).toBe(true);
      expect(metadata.kind).toBe('template');
    });

    it('leaves isPublic untouched on regular saves', async () => {
      await unifiedTemplateStorageService.saveTemplate(
        { name: 'My Design', templateData: { width: 1000, height: 600, elements: [] } },
        mockRequest()
      );

      const call = mockTemplateUpsert.mock.calls[0][0] as any;
      expect(call.create.isPublic).toBeUndefined();
      expect(call.update.isPublic).toBeUndefined();
    });

    it('rejects overwriting an existing global without the flag, even for the owner', async () => {
      mockTemplateFindMany.mockResolvedValue([
        dbTemplateRow({ name: 'Global Card', isPublic: true }),
      ]);

      await expect(
        unifiedTemplateStorageService.saveTemplate(
          { name: 'Global Card', templateData: { width: 1000, height: 600, elements: [] } },
          mockRequest()
        )
      ).rejects.toMatchObject({ statusCode: 403, code: 'insufficient_role' });
      expect(mockTemplateUpsert).not.toHaveBeenCalled();
    });
  });

  describe('listTemplates', () => {
    it('returns own + global templates with isPublic mapped', async () => {
      mockTemplateFindMany.mockResolvedValue([
        dbTemplateRow({ id: 'own-1', name: 'Mine', isPublic: false }),
        dbTemplateRow({ id: 'glob-1', userId: 'other-user', name: 'Global', isPublic: true }),
      ]);

      const list = await unifiedTemplateStorageService.listTemplates(mockRequest());

      // includeGlobals merge passed down to the operations layer
      expect(mockTemplateFindMany.mock.calls[0][0].where).toEqual({
        OR: [{ userId: USER.id }, { isPublic: true }],
      });
      expect(list).toHaveLength(2);
      expect(list.find(t => t.id === 'glob-1')?.isPublic).toBe(true);
      expect(list.find(t => t.id === 'own-1')?.isPublic).toBe(false);
    });
  });

  describe('loadTemplate', () => {
    it('loads a global template for a non-owner', async () => {
      mockTemplateFindFirst.mockResolvedValue(
        dbTemplateRow({ userId: 'other-user', isPublic: true })
      );

      const template = await unifiedTemplateStorageService.loadTemplate('tpl-1', mockRequest());

      expect(template.id).toBe('tpl-1');
      expect(template.metadata.isPublic).toBe(true);
      expect(template.userId).toBe('other-user');
    });

    it('still rejects a private template owned by another user', async () => {
      mockTemplateFindFirst.mockResolvedValue(
        dbTemplateRow({ userId: 'other-user', isPublic: false })
      );

      await expect(
        unifiedTemplateStorageService.loadTemplate('tpl-1', mockRequest())
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('deleteTemplate', () => {
    it('rejects deleting a global without the role-verified flag', async () => {
      mockTemplateFindFirst.mockResolvedValue(dbTemplateRow({ isPublic: true }));

      await expect(
        unifiedTemplateStorageService.deleteTemplate('tpl-1', mockRequest())
      ).rejects.toMatchObject({ statusCode: 403, code: 'insufficient_role' });
      expect(mockTemplateDelete).not.toHaveBeenCalled();
    });

    it('deletes a global when the request is role-verified', async () => {
      mockTemplateFindFirst.mockResolvedValue(dbTemplateRow({ isPublic: true }));

      await unifiedTemplateStorageService.deleteTemplate(
        'tpl-1',
        mockRequest({ [GLOBAL_TEMPLATES_AUTHORIZED]: true })
      );

      expect(mockTemplateDelete).toHaveBeenCalledTimes(1);
    });

    it('deletes a private own template without any role flag (existing behavior)', async () => {
      mockTemplateFindFirst.mockResolvedValue(dbTemplateRow({ isPublic: false }));

      await unifiedTemplateStorageService.deleteTemplate('tpl-1', mockRequest());

      expect(mockTemplateDelete).toHaveBeenCalledTimes(1);
    });
  });
});
