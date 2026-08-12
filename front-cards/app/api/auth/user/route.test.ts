/**
 * @jest-environment node
 *
 * Pass 5 — /api/auth/user exposes app_roles decoded from the access-token
 * JWT (UI hint only; the api-server enforces authoritatively).
 */

jest.mock('@/shared/server/oauth-fetch', () => ({
  oauthServerFetch: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import { GET } from './route';
import { oauthServerFetch } from '@/shared/server/oauth-fetch';

const mockOauthFetch = oauthServerFetch as jest.Mock;

function makeToken(payload: unknown): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
}

function requestWithToken(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) => (token && name === 'ecards_auth' ? { value: token } : undefined),
    },
  } as unknown as NextRequest;
}

describe('GET /api/auth/user — roles exposure (Pass 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOauthFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    });
  });

  it('includes roles decoded from the access-token JWT', async () => {
    const response = await GET(requestWithToken(makeToken({ app_roles: ['appsuper'] })));
    const body = await response.json();

    expect(body.id).toBe('u1');
    expect(body.roles).toEqual(['appsuper']);
  });

  it('returns an empty roles array when the claim is absent', async () => {
    const response = await GET(requestWithToken(makeToken({ sub: 'u1' })));
    const body = await response.json();

    expect(body.roles).toEqual([]);
  });

  it('returns an empty roles array for a malformed token', async () => {
    const response = await GET(requestWithToken('not-a-jwt'));
    const body = await response.json();

    expect(body.roles).toEqual([]);
  });

  it('reports signed-out when no token cookie is present', async () => {
    const response = await GET(requestWithToken(undefined));
    const body = await response.json();

    expect(body).toEqual({ authenticated: false });
    expect(mockOauthFetch).not.toHaveBeenCalled();
  });
});
