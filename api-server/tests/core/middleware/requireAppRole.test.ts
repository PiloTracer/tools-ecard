/**
 * Pass 5 — requireAppRole preHandler (authoritative validate-token role gate).
 * The dashboard fetch is mocked; assertions cover role acceptance (either
 * appsuper or appglobal), denial, invalid tokens, and fail-closed behavior.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockOauthFetch: any = jest.fn();

jest.mock('../../../src/core/oauthFetch', () => ({
  oauthServerFetch: (...args: unknown[]) => mockOauthFetch(...args),
}));

// eslint-disable-next-line import/first
import {
  requireAppRole,
  canManageGlobalTemplates,
  GLOBAL_TEMPLATES_AUTHORIZED,
} from '../../../src/core/middleware/requireAppRole';

const mockRequest = (overrides?: any) => ({
  headers: {},
  cookies: {},
  ...overrides,
});

const mockReply = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

function mockValidateTokenResponse(body: any, ok = true, status = 200) {
  mockOauthFetch.mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
}

describe('canManageGlobalTemplates', () => {
  it('grants for either appsuper or appglobal', () => {
    expect(canManageGlobalTemplates(['appsuper'])).toBe(true);
    expect(canManageGlobalTemplates(['appglobal'])).toBe(true);
    expect(canManageGlobalTemplates(['appsuper', 'appglobal'])).toBe(true);
  });

  it('denies by default and ignores unknown roles', () => {
    expect(canManageGlobalTemplates([])).toBe(false);
    expect(canManageGlobalTemplates(['appuser'])).toBe(false);
    expect(canManageGlobalTemplates(['appfuture'])).toBe(false);
    expect(canManageGlobalTemplates(undefined)).toBe(false);
  });
});

describe('requireAppRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when no token is present', async () => {
    const req = mockRequest() as any;
    const reply = mockReply() as any;
    await requireAppRole(req, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(mockOauthFetch).not.toHaveBeenCalled();
  });

  it('passes and flags the request for appsuper (Bearer token)', async () => {
    mockValidateTokenResponse({ valid: true, app_roles: ['appsuper'] });
    const req = mockRequest({ headers: { authorization: 'Bearer tok-super' } }) as any;
    const reply = mockReply() as any;

    await requireAppRole(req, reply);

    expect(mockOauthFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockOauthFetch.mock.calls[0] as any[];
    expect(String(url)).toContain('/auth/internal/oauth/validate-token');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ token: 'tok-super' });
    expect(reply.status).not.toHaveBeenCalled();
    expect(req[GLOBAL_TEMPLATES_AUTHORIZED]).toBe(true);
  });

  it('passes for appglobal (token from cookie)', async () => {
    mockValidateTokenResponse({ valid: true, app_roles: ['appglobal'] });
    const req = mockRequest({ cookies: { ecards_auth: 'tok-global' } }) as any;
    const reply = mockReply() as any;

    await requireAppRole(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(req[GLOBAL_TEMPLATES_AUTHORIZED]).toBe(true);
  });

  it('returns 403 when the token lacks both roles', async () => {
    mockValidateTokenResponse({ valid: true, app_roles: ['appuser'] });
    const req = mockRequest({ headers: { authorization: 'Bearer tok-plain' } }) as any;
    const reply = mockReply() as any;

    await requireAppRole(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'insufficient_role' })
    );
    expect(req[GLOBAL_TEMPLATES_AUTHORIZED]).toBeUndefined();
  });

  it('returns 403 when app_roles is missing or not an array', async () => {
    mockValidateTokenResponse({ valid: true });
    const req = mockRequest({ headers: { authorization: 'Bearer tok-noroles' } }) as any;
    const reply = mockReply() as any;

    await requireAppRole(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 when the dashboard says the token is not valid', async () => {
    mockValidateTokenResponse({ valid: false, error: 'revoked' });
    const req = mockRequest({ headers: { authorization: 'Bearer tok-revoked' } }) as any;
    const reply = mockReply() as any;

    await requireAppRole(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(req[GLOBAL_TEMPLATES_AUTHORIZED]).toBeUndefined();
  });

  it('fails closed with 503 when the dashboard answers non-OK', async () => {
    mockValidateTokenResponse({}, false, 500);
    const req = mockRequest({ headers: { authorization: 'Bearer tok' } }) as any;
    const reply = mockReply() as any;

    await requireAppRole(req, reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'role_validation_unavailable' })
    );
  });

  it('fails closed with 503 when the dashboard is unreachable', async () => {
    mockOauthFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const req = mockRequest({ headers: { authorization: 'Bearer tok' } }) as any;
    const reply = mockReply() as any;

    await requireAppRole(req, reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'role_validation_unavailable' })
    );
  });
});
