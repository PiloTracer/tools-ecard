/**
 * Pass 5 — app_roles JWT claim decode (fast "rendering" path).
 * Malformed tokens, missing claims, and non-array values must all yield [].
 */
import { describe, it, expect } from '@jest/globals';
import { decodeAppRolesFromToken } from '../../../src/core/middleware/authMiddleware';

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

  it('returns [] when the claim is missing', () => {
    expect(decodeAppRolesFromToken(makeToken({ sub: 'user-1' }))).toEqual([]);
  });

  it('returns [] when the claim is not an array', () => {
    expect(decodeAppRolesFromToken(makeToken({ app_roles: 'appsuper' }))).toEqual([]);
    expect(decodeAppRolesFromToken(makeToken({ app_roles: 42 }))).toEqual([]);
    expect(decodeAppRolesFromToken(makeToken({ app_roles: null }))).toEqual([]);
  });

  it('filters non-string entries out of the claim', () => {
    expect(
      decodeAppRolesFromToken(makeToken({ app_roles: ['appsuper', 7, null, { role: 'x' }] }))
    ).toEqual(['appsuper']);
  });

  it('returns [] for malformed tokens', () => {
    expect(decodeAppRolesFromToken('not-a-jwt')).toEqual([]);
    expect(decodeAppRolesFromToken('')).toEqual([]);
    expect(decodeAppRolesFromToken('a.!!!not-base64-json!!!.c')).toEqual([]);
    expect(decodeAppRolesFromToken(`h.${Buffer.from('not json').toString('base64url')}.s`)).toEqual([]);
  });
});
