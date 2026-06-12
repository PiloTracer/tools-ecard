/**
 * Authentication Middleware
 *
 * Extracts user information from access token cookie and populates request.user.
 * Validates the token against the Tools Dashboard OAuth provider's userinfo endpoint.
 *
 * Two modes:
 * - DEFAULT: populates request.user if valid token, allows anonymous requests through
 * - STRICT (requireAuth): returns 401 if no valid token (use for authenticated-only routes)
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { userOperations, projectOperations } from '../prisma/client';
import { createLogger } from '../utils/logger';
import { oauthServerFetch } from '../oauthFetch';

const log = createLogger('AuthMiddleware');

const OAUTH_CONFIG = {
  userInfoEndpoint: process.env.OAUTH_USER_INFO_ENDPOINT || 'https://dev.aiepic.app/api/users/me',
};

const COOKIE_CONFIG = {
  accessToken: {
    name: process.env.SESSION_COOKIE_NAME || 'ecards_auth',
  },
};

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  oauthId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

// ─── Token cache ───────────────────────────────────────────────
// Cache userinfo responses by token to avoid hitting the Tools
// Dashboard on every API request. TTL is 60 seconds — short enough
// that revoked tokens are detected quickly, long enough to reduce
// load on the identity server by 95%+ under normal traffic.
interface CacheEntry {
  user: AuthenticatedUser;
  fetchedAt: number;
}

const tokenCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCachedUser(accessToken: string): AuthenticatedUser | null {
  const entry = tokenCache.get(accessToken);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    tokenCache.delete(accessToken);
    return null;
  }
  return entry.user;
}

function setCachedUser(accessToken: string, user: AuthenticatedUser): void {
  // Prevent unbounded growth — if cache exceeds 1000 entries, drop oldest 10%
  if (tokenCache.size >= 1000) {
    const keysToDelete = [...tokenCache.keys()].slice(0, 100);
    for (const k of keysToDelete) tokenCache.delete(k);
  }
  tokenCache.set(accessToken, { user, fetchedAt: Date.now() });
}

function invalidateCachedToken(accessToken: string): void {
  tokenCache.delete(accessToken);
}

// ─── Token extraction ───────────────────────────────────────────

function getAccessToken(request: FastifyRequest): string | undefined {
  // Check Authorization header first (for server-to-server calls)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie (for browser-sent requests)
  const fromCookie = request.cookies[COOKIE_CONFIG.accessToken.name];
  return fromCookie;
}

// ─── Core auth logic ────────────────────────────────────────────

async function fetchAndCacheUser(accessToken: string): Promise<AuthenticatedUser | null> {
  // Check cache first
  const cached = getCachedUser(accessToken);
  if (cached) return cached;

  try {
    const userResponse = await oauthServerFetch(OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      log.warn({ status: userResponse.status }, 'Userinfo endpoint rejected token');
      return null;
    }

    const userData = (await userResponse.json()) as Record<string, any>;

    const user: AuthenticatedUser = {
      id: userData.email,
      email: userData.email,
      username: userData.username || userData.email,
      displayName: userData.displayName || userData.name || userData.username || userData.email,
      oauthId: userData.id?.toString(),
    };

    setCachedUser(accessToken, user);
    return user;
  } catch (error) {
    log.error({ error }, 'Failed to validate token against Tools Dashboard');
    return null;
  }
}

async function syncUserToDatabase(user: AuthenticatedUser): Promise<void> {
  try {
    await userOperations.upsertUser({
      id: user.id,
      email: user.email,
      name: user.displayName,
      oauthId: user.oauthId,
    });
    await projectOperations.ensureDefaultProject(user.id);
  } catch (dbError) {
    log.error({ error: dbError, userId: user.id }, 'Failed to sync user to database');
    // Continue — don't fail the request if DB sync fails
  }
}

// ─── Middleware factory ──────────────────────────────────────────

/**
 * Default auth middleware: populates request.user if a valid token is present.
 * Does NOT block anonymous requests — individual route handlers should
 * check request.user and return 401 for authenticated-only endpoints.
 *
 * Use as:
 *   fastify.addHook('preHandler', authMiddleware)
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const accessToken = getAccessToken(request);
  if (!accessToken) return; // No token — proceed as anonymous

  const user = await fetchAndCacheUser(accessToken);
  if (!user) return; // Invalid/expired token — proceed as anonymous

  request.user = user;

  // Fire-and-forget DB sync (don't block the request)
  syncUserToDatabase(user);
}

/**
 * Strict auth middleware: blocks the request with 401 if no valid token
 * is present. Use for routes that require authentication.
 *
 * Use as:
 *   fastify.addHook('preHandler', requireAuth)
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    reply.status(401).send({ success: false, error: 'Authentication required' });
    return;
  }

  const user = await fetchAndCacheUser(accessToken);
  if (!user) {
    invalidateCachedToken(accessToken);
    reply.status(401).send({ success: false, error: 'Invalid or expired token' });
    return;
  }

  request.user = user;
  syncUserToDatabase(user);
}

/**
 * Invalidate a cached token (call on logout/token revocation).
 */
export function invalidateToken(token: string): void {
  invalidateCachedToken(token);
}
