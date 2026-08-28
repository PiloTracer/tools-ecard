/**
 * @jest-environment jsdom
 */

import { templateService } from './templateService';
import type { SaveTemplateRequest, TemplateMetadata } from './templateService';
import type { Template } from '../types';

jest.mock('@/features/demo/isDemoMode', () => ({
  isDemoMode: jest.fn(() => false),
}));

jest.mock('@/features/demo/demoTemplateRepository', () => ({
  demoTemplateRepository: {
    saveTemplate: jest.fn(),
    loadTemplate: jest.fn(),
    listTemplates: jest.fn(),
    deleteTemplate: jest.fn(),
  },
}));

jest.mock('./browserStorageService', () => ({
  browserStorageService: {
    cacheTemplate: jest.fn(),
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    clearAllCache: jest.fn(),
    getStorageStats: jest.fn(),
  },
}));

jest.mock('./resourceManager', () => ({
  resourceManager: { preloadResources: jest.fn() },
}));

jest.mock('./bundledTemplatesService', () => ({
  bundledTemplatesService: { loadBundledTemplate: jest.fn() },
  BUNDLED_TEMPLATE_PREFIX: 'bundled:',
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { browserStorageService } = require('./browserStorageService');

const globalScope = globalThis as { fetch?: unknown };
const fetchMock = jest.fn();

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {}
): Promise<Response> {
  return Promise.resolve({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

/** Routes /mode, POST save and GET list to the given handlers. */
function mockApi(handlers: {
  mode?: string;
  onPost?: () => Promise<Response>;
  list?: unknown[];
}): void {
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith('/mode')) {
      return jsonResponse({ data: { mode: handlers.mode ?? 'FULL' } });
    }
    if (method === 'POST' && url.endsWith('/api/v1/template-textile')) {
      return handlers.onPost
        ? handlers.onPost()
        : jsonResponse({ data: serverMetadata() });
    }
    if (method === 'GET' && url.includes('/api/v1/template-textile')) {
      return jsonResponse({ data: handlers.list ?? [] });
    }
    return jsonResponse({}, { ok: false, status: 404, statusText: 'Not Found' });
  });
}

function findSavePostBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([input, init]) =>
      String(input).endsWith('/api/v1/template-textile') &&
      (init as RequestInit | undefined)?.method === 'POST'
  );
  expect(call).toBeDefined();
  return JSON.parse(String((call?.[1] as RequestInit).body)) as Record<string, unknown>;
}

function makeTemplate(): Template {
  return {
    id: 'client-uuid-1',
    name: 'Card',
    width: 640,
    height: 400,
    elements: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function serverMetadata(overrides: Partial<TemplateMetadata> = {}): TemplateMetadata {
  return {
    id: 'srv-1',
    userId: 'user-1',
    name: 'Card',
    storageUrl: 's3://bucket/srv-1.json',
    storageMode: 'FULL',
    resourceUrls: [],
    version: 1,
    kind: 'design',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function saveRequest(overrides: Partial<SaveTemplateRequest> = {}): SaveTemplateRequest {
  return {
    name: 'Card',
    templateData: makeTemplate(),
    kind: 'design',
    ...overrides,
  };
}

describe('templateService.saveTemplate request shaping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalScope.fetch = fetchMock;
    browserStorageService.cacheTemplate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete globalScope.fetch;
    jest.restoreAllMocks();
  });

  it('includes id in the POST body on identity-keyed (in-place) saves', async () => {
    mockApi({ mode: 'FULL' });

    await templateService.saveTemplate(saveRequest({ id: 'tpl-1' }));

    const body = findSavePostBody();
    expect(body.id).toBe('tpl-1');
    expect(body.name).toBe('Card');
  });

  it('omits id from the POST body for creates/forks (server creates fresh)', async () => {
    mockApi({ mode: 'FULL' });

    await templateService.saveTemplate(saveRequest());

    const body = findSavePostBody();
    expect('id' in body).toBe(false);
  });

  it('marks FALLBACK saves as unsynced when the server write fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({
      mode: 'FALLBACK',
      onPost: () => jsonResponse({}, { ok: false, status: 500, statusText: 'Server Error' }),
    });

    const metadata = await templateService.saveTemplate(saveRequest());

    expect(metadata.storageMode).toBe('FALLBACK');
    expect(metadata.unsynced).toBe(true);
    expect(browserStorageService.cacheTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Card', unsynced: true })
    );
  });

  it('marks LOCAL_ONLY saves as unsynced', async () => {
    mockApi({ mode: 'LOCAL_ONLY' });

    const metadata = await templateService.saveTemplate(saveRequest());

    expect(metadata.storageMode).toBe('LOCAL_ONLY');
    expect(metadata.unsynced).toBe(true);
    expect(browserStorageService.cacheTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Card', unsynced: true })
    );
  });
});

describe('templateService.listTemplates twin dedupe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalScope.fetch = fetchMock;
  });

  afterEach(() => {
    delete globalScope.fetch;
    jest.restoreAllMocks();
  });

  it('hides a local same-named twin when a server record exists (server wins, warn logged)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockApi({
      mode: 'FULL',
      list: [serverMetadata({ id: 'srv-1', name: 'Card A' })],
    });
    browserStorageService.listTemplates.mockResolvedValue([
      { id: 'local-twin', name: 'Card A', data: {}, resources: [], timestamp: 1, kind: 'design' },
      { id: 'local-only', name: 'Only Local', data: {}, resources: [], timestamp: 2, kind: 'design' },
    ]);

    const result = await templateService.listTemplates();

    expect(result.map(t => t.id)).toEqual(['srv-1', 'local-only']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Card A'));
  });
});
