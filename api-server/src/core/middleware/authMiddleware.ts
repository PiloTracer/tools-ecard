/**
 * Authentication Middleware
 *
 * Extracts user information from access token cookie and populates request.user
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { userOperations, projectOperations } from '../prisma/client';

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

      console.log('[Auth] User authenticated:', {
        id: request.user.id,
        email: request.user.email,
        username: request.user.username,
      });

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
        console.error('[Auth] Failed to sync user to database:', dbError);
        // Continue even if DB sync fails
      }
    } else {
      console.warn('[Auth] Failed to fetch user info:', userResponse.status);
      // Token might be expired or invalid - proceed without user
    }
  } catch (error) {
    console.error('[Auth] Middleware error:', error);
    // Don't fail the request if auth check fails - let it proceed
  }
}
