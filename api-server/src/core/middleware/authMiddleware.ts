/**
 * Authentication Middleware
 *
 * Extracts user information from access token cookie and populates request.user
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
  id: string; // User ID from external auth system
  email: string;
  username: string;
  displayName: string;
  oauthId?: string; // OAuth provider's ID (optional)
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

function getAccessToken(request: FastifyRequest): string | undefined {
  const fromCookie = request.cookies[COOKIE_CONFIG.accessToken.name];
  if (fromCookie) {
    return fromCookie;
  }
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    return token || undefined;
  }
  return undefined;
}

/**
 * Auth middleware - extracts user from cookie or Bearer token and fetches user info
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const accessToken = getAccessToken(request);

    if (!accessToken) {
      // No token - request will proceed without user (controllers can decide if auth is required)
      return;
    }

    // Fetch user information from external auth service
    const userResponse = await oauthServerFetch(OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (userResponse.ok) {
      const userData = (await userResponse.json()) as Record<string, any>;

      // Populate request.user with authenticated user info
      // Use email as the primary ID for database operations
      request.user = {
        id: userData.email, // Always use email as ID for consistency
        email: userData.email,
        username: userData.username || userData.email,
        displayName: userData.displayName || userData.name || userData.username || userData.email,
        oauthId: userData.id?.toString() // Store OAuth provider's ID separately if needed
      };

      const user = request.user;
      log.debug({
        userId: user!.id,
        email: user!.email,
        username: user!.username
      }, 'User authenticated');

      // Ensure user exists in database
      if (user) {
        try {
          await userOperations.upsertUser({
            id: user.id,
            email: user.email,
            name: user.displayName,
            oauthId: userData.oauth_id || userData.id?.toString()
          });

          // Ensure user has a default project
          await projectOperations.ensureDefaultProject(user.id);
        } catch (dbError) {
          log.error({ error: dbError, userId: user.id }, 'Failed to sync user to database');
          // Continue even if DB sync fails
        }
      }
    } else {
      log.warn({ status: userResponse.status }, 'Failed to fetch user info - token may be expired or invalid');
      // Token might be expired or invalid - proceed without user
    }
  } catch (error) {
    log.error({ error }, 'Auth middleware error');
    // Don't fail the request if auth check fails - let it proceed
  }
}
