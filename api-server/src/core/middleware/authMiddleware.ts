/**
 * Authentication Middleware
 *
 * Extracts user information from access token cookie and populates request.user
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { userOperations, projectOperations } from '../prisma/client';
import { createLogger } from '../utils/logger';

const log = createLogger('AuthMiddleware');

const OAUTH_CONFIG = {
  userInfoEndpoint: process.env.OAUTH_USER_INFO_ENDPOINT || 'http://epicdev.com/api/users/me',
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
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Auth middleware - extracts user from cookie and fetches user info
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get access token from cookie
    const accessToken = request.cookies[COOKIE_CONFIG.accessToken.name];

    if (!accessToken) {
      // No token - request will proceed without user (controllers can decide if auth is required)
      return;
    }

    // Fetch user information from external auth service
    const userResponse = await fetch(OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();

      // Populate request.user with authenticated user info
      // Use email as the primary ID for database operations
      request.user = {
        id: userData.email, // Always use email as ID for consistency
        email: userData.email,
        username: userData.username || userData.email,
        displayName: userData.displayName || userData.name || userData.username || userData.email,
        oauthId: userData.id?.toString() // Store OAuth provider's ID separately if needed
      };

      log.debug({
        userId: request.user.id,
        email: request.user.email,
        username: request.user.username
      }, 'User authenticated');

      // Ensure user exists in database
      try {
        await userOperations.upsertUser({
          id: request.user.id,
          email: request.user.email,
          name: request.user.displayName,
          oauthId: userData.oauth_id || userData.id?.toString()
        });

        // Ensure user has a default project
        await projectOperations.ensureDefaultProject(request.user.id);
      } catch (dbError) {
        log.error({ error: dbError, userId: request.user.id }, 'Failed to sync user to database');
        // Continue even if DB sync fails
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
