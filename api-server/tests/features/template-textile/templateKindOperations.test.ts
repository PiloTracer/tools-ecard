/**
 * Pass 4 — templateOperations kind persistence + ?kind= filter.
 * Prisma client is mocked; assertions target the exact upsert/create payloads
 * and list where-clauses built by templateOperations.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockUpsert: any = jest.fn();
const mockFindMany: any = jest.fn();
const mockCount: any = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    templateMetadata: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    $disconnect: jest.fn(),
  })),
}));

// eslint-disable-next-line import/first
import { templateOperations } from '../../../src/core/prisma/client';

const BASE_DATA = {
  id: 'tpl-1',
  userId: 'user-1',
  projectId: 'proj-1',
  projectName: 'Default Project',
  name: 'Base Card',
  width: 1000,
  height: 600,
  exportWidth: 1000,
  exportHeight: 600,
  storageUrl: 'fallback:///x',
  storageMode: 'fallback',
};

describe('templateOperations — kind (Pass 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({});
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('persists kind on create and update when provided', async () => {
    await templateOperations.upsertTemplate({ ...BASE_DATA, kind: 'template' });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0] as any;
    expect(call.create.kind).toBe('template');
    expect(call.update.kind).toBe('template');
  });

  it('leaves kind undefined when not provided (DB default / existing value applies)', async () => {
    await templateOperations.upsertTemplate(BASE_DATA);

    const call = mockUpsert.mock.calls[0][0] as any;
    expect(call.create.kind).toBeUndefined();
    expect(call.update.kind).toBeUndefined();
  });

  it('applies the kind filter to the list where-clause', async () => {
    await templateOperations.listTemplates('user-1', undefined, 1, 20, 'template');

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany.mock.calls[0][0].where).toEqual({
      userId: 'user-1',
      kind: 'template',
    });
    expect(mockCount.mock.calls[0][0].where).toEqual({
      userId: 'user-1',
      kind: 'template',
    });
  });

  it('lists without a kind filter when none is given (existing behavior unchanged)', async () => {
    await templateOperations.listTemplates('user-1');

    expect(mockFindMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
  });
});
