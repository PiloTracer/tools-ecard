/**
 * OAuth 2.0 Configuration
 *
 * Configuration for OAuth integration with Tools Dashboard
 *
 * IMPORTANT: All endpoints respect the protocol (http/https) from environment variables
 */

export const OAUTH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID || 'ecards_app_dev',
  authorizationEndpoint: process.env.NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT || 'https://dev.aiepic.app/oauth/authorize',
  tokenEndpoint: process.env.NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT || 'https://dev.aiepic.app/oauth/token',
  userInfoEndpoint: process.env.NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT || 'https://dev.aiepic.app/api/users/me',

  // Redirect URIs - must match registered URIs in Tools Dashboard
  redirectUris: {
    auth: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:7300'}/oauth/complete`,
    oauth: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:7300'}/oauth/complete`,
  },

  // Requested scopes
  scopes: ['profile', 'email', 'subscription'],

  // PKCE configuration
  pkce: {
    enabled: true,
    codeChallengeMethod: 'S256' as const,
  },

  // State parameter (CSRF protection)
  state: {
    enabled: true,
  },
} as const;

/**
 * User Subscription URL
 * Where users can view/upgrade their subscription in the Tools Dashboard
 * Respects HTTP/HTTPS from environment variable
 */
export const USER_SUBSCRIPTION_URL =
  process.env.NEXT_PUBLIC_USER_SUBSCRIPTION_URL ||
  'https://dev.aiepic.app/app/features/user-subscription';

/**
 * Tools Dashboard home (app library) — derived from the subscription URL's
 * origin so it follows the same per-environment config
 * (dev.aiepic.app / tools.datawork.top), path fixed to the app library.
 */
export const TOOLS_DASHBOARD_HOME_URL = (() => {
  try {
    return `${new URL(USER_SUBSCRIPTION_URL).origin}/app/features/app-library`;
  } catch {
    return 'https://dev.aiepic.app/app/features/app-library';
  }
})();

/**
 * After OAuth completes (server /oauth/complete or client /auth/callback), browser goes here.
 * Default: stay on E-Cards (`/dashboard`). Set to an absolute URL (e.g. Tools Dashboard app
 * library) if you want users sent off-host after login (uses /auth/continue so cookies stick).
 */
export const POST_LOGIN_REDIRECT_URL =
  process.env.NEXT_PUBLIC_POST_LOGIN_REDIRECT_URL || '/dashboard';
