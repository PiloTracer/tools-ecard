/**
 * App-role authorization middleware (global-template management).
 *
 * tools-dashboard issues access-token JWTs carrying an `app_roles` claim.
 * Two roles unlock global-template management: `appsuper` (per-app) and
 * `appglobal` (all apps). EITHER grants access — plain membership check,
 * no implication mapping, deny by default, unknown future roles ignored.
 *
 * This preHandler is the AUTHORITATIVE path: it re-validates the token and
 * its roles against the dashboard's validate-token endpoint on every call
 * (these are rare mutations, so no caching beyond the token lifetime). The
 * JWT-claim decode in authMiddleware is only the fast "rendering" path.
 *
 * Fail-CLOSED policy: if the dashboard cannot be reached or answers with a
 * non-OK status, the request is rejected with 503 (role check unavailable)
 * rather than allowed through.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../utils/logger';
import { oauthServerFetch } from '../oauthFetch';
import { extractAccessToken } from './authMiddleware';

const log = createLogger('RequireAppRole');

/**
 * Request flag set by requireAppRole after a successful authoritative role
 * check. The template storage service re-checks this flag before mutating
 * global (isPublic) templates — defense in depth against future routes that
 * forget the preHandler.
 */
export const GLOBAL_TEMPLATES_AUTHORIZED = 'globalTemplatesAuthorized';

function defaultValidateTokenEndpoint(): string {
  const userInfo =
    process.env.OAUTH_USER_INFO_ENDPOINT || 'https://dev.aiepic.app/api/users/me';
  try {
    return `${new URL(userInfo).origin}/auth/internal/oauth/validate-token`;
  } catch {
    return 'https://dev.aiepic.app/auth/internal/oauth/validate-token';
  }
}

function validateTokenEndpoint(): string {
  return process.env.OAUTH_VALIDATE_TOKEN_ENDPOINT || defaultValidateTokenEndpoint();
}

/** Either `appsuper` or `appglobal` grants global-template management. */
export function canManageGlobalTemplates(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.includes('appsuper') || roles.includes('appglobal');
}

/**
 * Fastify preHandler: requires a valid token whose app_roles include
 * `appsuper` or `appglobal` (authoritative validate-token check).
 *
 *   401 — no token, or dashboard says the token is not valid
 *   403 — valid token without either role (code: insufficient_role)
 *   503 — role check unavailable (network/5xx; fail closed)
 */
export async function requireAppRole(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const accessToken = extractAccessToken(request);
  if (!accessToken) {
    reply.status(401).send({ success: false, error: 'Authentication required' });
    return;
  }

  let data: any;
  try {
    const response = await oauthServerFetch(validateTokenEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: accessToken }),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, 'validate-token endpoint returned non-OK — failing closed');
      reply.status(503).send({
        success: false,
        error: 'Role validation unavailable',
        code: 'role_validation_unavailable',
      });
      return;
    }

    data = await response.json();
  } catch (error) {
    log.error({ error }, 'validate-token call failed — failing closed');
    reply.status(503).send({
      success: false,
      error: 'Role validation unavailable',
      code: 'role_validation_unavailable',
    });
    return;
  }

  if (data?.valid !== true) {
    reply.status(401).send({ success: false, error: 'Invalid or expired token' });
    return;
  }

  const roles: string[] = Array.isArray(data?.app_roles)
    ? data.app_roles.filter((r: unknown): r is string => typeof r === 'string')
    : [];

  if (!canManageGlobalTemplates(roles)) {
    reply.status(403).send({
      success: false,
      error: 'Global template management requires an elevated app role',
      code: 'insufficient_role',
    });
    return;
  }

  (request as any)[GLOBAL_TEMPLATES_AUTHORIZED] = true;
}
