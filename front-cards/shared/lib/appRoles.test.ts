import { decodeAppRolesFromToken, canManageGlobalTemplates } from './appRoles';

function makeToken(payload: unknown): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
}

describe('decodeAppRolesFromToken', () => {
  it('extracts app_roles from a valid JWT payload', () => {
    expect(decodeAppRolesFromToken(makeToken({ app_roles: ['appsuper'] }))).toEqual(['appsuper']);
    expect(decodeAppRolesFromToken(makeToken({ app_roles: ['appsuper', 'appglobal'] }))).toEqual([
      'appsuper',
      'appglobal',
    ]);
  });

  it('returns [] for missing, non-array, or malformed claims/tokens', () => {
    expect(decodeAppRolesFromToken(makeToken({ sub: 'user-1' }))).toEqual([]);
    expect(decodeAppRolesFromToken(makeToken({ app_roles: 'appsuper' }))).toEqual([]);
    expect(decodeAppRolesFromToken('not-a-jwt')).toEqual([]);
    expect(decodeAppRolesFromToken('')).toEqual([]);
    expect(decodeAppRolesFromToken(`h.${Buffer.from('not json').toString('base64url')}.s`)).toEqual(
      []
    );
  });

  it('filters non-string entries out of the claim', () => {
    expect(
      decodeAppRolesFromToken(makeToken({ app_roles: ['appglobal', 7, null] }))
    ).toEqual(['appglobal']);
  });
});

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
