/**
 * Identity-keyed save (GD-T1 + H-1): saveTemplate resolves the target record
 * by explicit id first (direct by-id fetch — never the paged list), falls
 * back to an unpaged name lookup, and keys storage blobs by template id so
 * same-named templates can't alias one blob. Prisma and storage dependencies
 * are mocked; assertions target upsert payloads, query paging, the S3 key,
 * and the global-template guard.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockTemplateUpsert: any = jest.fn();
const mockTemplateFindMany: any = jest.fn();
const mockTemplateFindFirst: any = jest.fn();
const mockTemplateCount: any = jest.fn();
const mockTemplateDelete: any = jest.fn();
const mockProjectUpsert: any = jest.fn();
const mockS3PutObject: any = jest.fn();

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
  getS3Service: jest.fn(() => ({
    bucketExists: jest.fn(async () => true),
    createBucket: jest.fn(async () => undefined),
    putObject: (...args: unknown[]) => mockS3PutObject(...args),
  })),
}));

// eslint-disable-next-line import/first
import { modeDetectionService } from '../../../src/features/template-textile/services/modeDetectionService';
// eslint-disable-next-line import/first
import { unifiedTemplateStorageService } from '../../../src/features/template-textile/services/unifiedTemplateStorageService';

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

const templateData = { width: 1000, height: 600, elements: [] };

describe('unifiedTemplateStorageService — identity-keyed save (GD-T1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectUpsert.mockResolvedValue({ id: 'proj-1', name: 'Default Project' });
    mockTemplateFindMany.mockResolvedValue([]);
    mockTemplateFindFirst.mockResolvedValue(undefined);
    mockTemplateCount.mockResolvedValue(0);
    mockTemplateUpsert.mockResolvedValue({});
    mockTemplateDelete.mockResolvedValue({});
    mockS3PutObject.mockResolvedValue({});
    (modeDetectionService.detectMode as any).mockResolvedValue({ mode: 'fallback' });
  });

  it('updates the id-matched row and increments its version', async () => {
    mockTemplateFindFirst.mockResolvedValue(
      dbTemplateRow({ id: 'tpl-9', name: 'Card', version: 3 })
    );

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { id: 'tpl-9', name: 'Card', templateData },
      mockRequest()
    );

    expect(metadata.id).toBe('tpl-9');
    expect(metadata.version).toBe(4);
    const call = mockTemplateUpsert.mock.calls[0][0] as any;
    expect(call.where.id).toBe('tpl-9');
    expect(call.update.version).toBe(4);
  });

  it('resolves an id-match beyond page 1 of the template list (H-1)', async () => {
    // The target is NOT in the paged list — 20 other rows fill page 1.
    mockTemplateFindFirst.mockResolvedValue(
      dbTemplateRow({ id: 'tpl-target', name: 'Card', version: 2 })
    );
    mockTemplateFindMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => dbTemplateRow({ id: `tpl-page1-${i}`, name: `Other ${i}` }))
    );

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { id: 'tpl-target', name: 'Card', templateData },
      mockRequest()
    );

    expect(metadata.id).toBe('tpl-target');
    expect(metadata.version).toBe(3);
    expect((mockTemplateUpsert.mock.calls[0][0] as any).where.id).toBe('tpl-target');
    // The id path is a direct by-id fetch — the paged list is never consulted.
    expect(mockTemplateFindMany).not.toHaveBeenCalled();
  });

  it('ignores an id owned by another user or project', async () => {
    mockTemplateFindFirst.mockResolvedValue(
      dbTemplateRow({ id: 'tpl-9', name: 'Card', projectId: 'other-project' })
    );

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { id: 'tpl-9', name: 'Card', templateData },
      mockRequest()
    );

    // Ownership scope mismatch → no id-match → no name match → new uuid.
    expect(metadata.id).not.toBe('tpl-9');
    expect(metadata.version).toBe(1);
  });

  it('falls back to the name lookup when the id is stale', async () => {
    mockTemplateFindMany.mockResolvedValue([
      dbTemplateRow({ id: 'tpl-real', name: 'Card', version: 2 }),
    ]);

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { id: 'stale-id', name: 'Card', templateData },
      mockRequest()
    );

    expect(metadata.id).toBe('tpl-real');
    expect(metadata.version).toBe(3);
    expect((mockTemplateUpsert.mock.calls[0][0] as any).where.id).toBe('tpl-real');
  });

  it('matches by name beyond page 1 via an unpaged lookup (H-1)', async () => {
    // 20 filler rows fill page 1; the name match is row 21.
    mockTemplateFindMany.mockResolvedValue([
      ...Array.from({ length: 20 }, (_, i) => dbTemplateRow({ id: `tpl-page1-${i}`, name: `Other ${i}` })),
      dbTemplateRow({ id: 'tpl-deep', name: 'Card', version: 5 }),
    ]);

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { name: 'Card', templateData },
      mockRequest()
    );

    expect(metadata.id).toBe('tpl-deep');
    expect(metadata.version).toBe(6);
    // The name lookup must not be paged at the default pageSize 20.
    const findManyArgs = mockTemplateFindMany.mock.calls[0][0] as any;
    expect(findManyArgs.take).toBe(1000);
    expect(findManyArgs.where).toEqual({ userId: USER.id, projectId: 'proj-1' });
  });

  it('creates a new template when neither id nor name matches', async () => {
    mockTemplateFindMany.mockResolvedValue([
      dbTemplateRow({ id: 'other', name: 'Other' }),
    ]);

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { id: 'stale-id', name: 'Fresh', templateData },
      mockRequest()
    );

    expect(metadata.id).not.toBe('stale-id');
    expect(metadata.id).not.toBe('other');
    expect(metadata.version).toBe(1);
    expect((mockTemplateUpsert.mock.calls[0][0] as any).create.id).toBe(metadata.id);
  });

  it('keeps the legacy name upsert when no id is provided', async () => {
    mockTemplateFindMany.mockResolvedValue([
      dbTemplateRow({ id: 'tpl-1', name: 'Card', version: 1 }),
    ]);

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { name: 'Card', templateData },
      mockRequest()
    );

    expect(metadata.id).toBe('tpl-1');
    expect(metadata.version).toBe(2);
  });

  it('writes the S3 blob under the template id', async () => {
    (modeDetectionService.detectMode as any).mockResolvedValue({ mode: 'full' });
    mockTemplateFindFirst.mockResolvedValue(
      dbTemplateRow({ id: 'tpl-9', name: 'Card', version: 1 })
    );

    const metadata = await unifiedTemplateStorageService.saveTemplate(
      { id: 'tpl-9', name: 'Card', templateData },
      mockRequest()
    );

    expect(mockS3PutObject).toHaveBeenCalledTimes(1);
    const [bucket, key] = mockS3PutObject.mock.calls[0] as any[];
    expect(bucket).toBe('repositories');
    expect(key).toBe(`templates/user-1_at_example_com/proj-1/tpl-9/template.json`);
    expect(metadata.storageUrl).toBe(`s3://repositories/${key}`);
  });

  it('rejects overwriting an id-matched global without the role flag', async () => {
    mockTemplateFindFirst.mockResolvedValue(
      dbTemplateRow({ id: 'tpl-9', name: 'Global', isPublic: true })
    );

    await expect(
      unifiedTemplateStorageService.saveTemplate(
        { id: 'tpl-9', name: 'Different Name', templateData },
        mockRequest()
      )
    ).rejects.toMatchObject({ statusCode: 403, code: 'insufficient_role' });
    expect(mockTemplateUpsert).not.toHaveBeenCalled();
  });

  it('updateTemplate re-saves under the same templateId and keeps kind (M-2)', async () => {
    // findFirst serves both the loadTemplate fetch and the save id-resolution.
    mockTemplateFindFirst.mockResolvedValue(
      dbTemplateRow({ id: 'tpl-1', name: 'Base Card', version: 2, kind: 'template' })
    );

    const metadata = await unifiedTemplateStorageService.updateTemplate(
      'tpl-1',
      { templateData },
      mockRequest()
    );

    expect(metadata.id).toBe('tpl-1');
    expect(metadata.version).toBe(3);
    const call = mockTemplateUpsert.mock.calls[0][0] as any;
    expect(call.where.id).toBe('tpl-1');
    expect(call.update.kind).toBe('template');
    // No delete-then-resave: the row is updated in place under its identity.
    expect(mockTemplateDelete).not.toHaveBeenCalled();
  });
});
