/**
 * App-role helpers (Pass 5 — global templates).
 *
 * tools-dashboard issues access-token JWTs with an `app_roles` claim.
 * `appsuper` (per-app) or `appglobal` (all apps) — EITHER grants
 * global-template management. Plain membership check, no implication
 * mapping, deny by default, unknown future roles ignored.
 *
 * Client-side roles are UI hints only; the api-server enforces
 * authoritatively via the dashboard validate-token endpoint.
 */

/**
 * Decode `app_roles` from a JWT access token payload (base64url, no
 * signature verification — this runs server-side in the auth route where
 * the token was already validated via userinfo; UI hint only).
 * Malformed tokens, missing claims, and non-array values all yield [].
 */
export function decodeAppRolesFromToken(accessToken: string): string[] {
  const parts = accessToken.split('.');
  if (parts.length < 2) return [];
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    const roles = payload?.app_roles;
    if (!Array.isArray(roles)) return [];
    return roles.filter((r): r is string => typeof r === 'string');
  } catch {
    return [];
  }
}

/** Either `appsuper` or `appglobal` grants global-template management. */
export function canManageGlobalTemplates(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.includes('appsuper') || roles.includes('appglobal');
}
