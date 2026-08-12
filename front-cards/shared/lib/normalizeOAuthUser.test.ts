import { normalizeOAuthUser } from './normalizeOAuthUser';

describe('normalizeOAuthUser', () => {
  it('maps OAuth userinfo fields to User', () => {
    expect(
      normalizeOAuthUser({
        id: 'oauth-42',
        email: 'pedro@code-cr.com',
        name: 'Pedro López',
        username: 'pedro',
      })
    ).toEqual({
      id: 'oauth-42',
      email: 'pedro@code-cr.com',
      username: 'pedro',
      display_name: 'Pedro López',
      avatar_url: undefined,
      subscription: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });
  });

  it('returns null for signed-out payload', () => {
    expect(normalizeOAuthUser({ authenticated: false })).toBeNull();
  });

  it('passes through string roles, drops non-array roles (Pass 5)', () => {
    expect(
      normalizeOAuthUser({ id: 'u1', email: 'a@b.c', roles: ['appsuper', 'appglobal'] })?.roles
    ).toEqual(['appsuper', 'appglobal']);
    expect(normalizeOAuthUser({ id: 'u1', email: 'a@b.c', roles: 'appsuper' })?.roles).toBeUndefined();
    expect(normalizeOAuthUser({ id: 'u1', email: 'a@b.c', roles: ['appsuper', 7] })?.roles).toEqual([
      'appsuper',
    ]);
  });
});
