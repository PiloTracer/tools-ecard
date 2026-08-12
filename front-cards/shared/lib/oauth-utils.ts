/**
 * OAuth 2.0 Utility Functions
 *
 * Helper functions for OAuth flow implementation with PKCE and state parameter
 */

import { OAUTH_CONFIG } from './oauth-config';

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate SHA-256 hash and encode as base64url
 */
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Convert hex to base64url
  const base64 = btoa(hashHex.match(/\w{2}/g)!.map(a => String.fromCharCode(parseInt(a, 16))).join(''));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * PKCE Helper: Generate code verifier and code challenge
 */
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await sha256(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * Generate OAuth state parameter (CSRF protection)
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Store OAuth state and code verifier in sessionStorage
 * Uses client ID-specific keys to distinguish between manual login and pre-initiated flows
 */
export function storeOAuthData(state: string, codeVerifier: string, clientId: string): void {
  if (typeof window === 'undefined') return;

  sessionStorage.setItem(`oauth_state_${clientId}`, state);
  sessionStorage.setItem(`code_verifier_${clientId}`, codeVerifier);
}

/**
 * Retrieve and validate OAuth state
 * Uses client ID-specific key to check against stored state from manual login flow
 */
export function validateState(receivedState: string, clientId: string): boolean {
  if (typeof window === 'undefined') return false;

  const storedState = sessionStorage.getItem(`oauth_state_${clientId}`);
  return storedState === receivedState;
}

/**
 * Retrieve code verifier from sessionStorage
 * Uses client ID-specific key to retrieve code verifier from manual login flow
 */
export function getCodeVerifier(clientId: string): string | null {
  if (typeof window === 'undefined') return null;

  return sessionStorage.getItem(`code_verifier_${clientId}`);
}

/**
 * Clear OAuth data from sessionStorage
 * Clears client ID-specific OAuth data
 */
export function clearOAuthData(clientId: string): void {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(`oauth_state_${clientId}`);
  sessionStorage.removeItem(`code_verifier_${clientId}`);
}

/**
 * Generate OAuth authorization URL with PKCE and state
 */
export async function generateAuthorizationUrl(
  redirectUri: string = OAUTH_CONFIG.redirectUris.auth
): Promise<string> {
  console.log('Generating OAuth authorization URL...');
  console.log('Redirect URI:', redirectUri);
  console.log('Client ID:', OAUTH_CONFIG.clientId);
  console.log('Scopes:', OAUTH_CONFIG.scopes);

  // Generate state for CSRF protection
  const state = generateState();

  // Generate PKCE code verifier and challenge
  const { codeVerifier, codeChallenge } = await generatePKCE();
  // Never log state/verifier/challenge values — they are single-use auth secrets.
  console.log('Generated state + PKCE code_verifier/code_challenge');

  // Store in sessionStorage with client ID-specific key
  storeOAuthData(state, codeVerifier, OAUTH_CONFIG.clientId);
  console.log('Stored OAuth data in sessionStorage with client ID:', OAUTH_CONFIG.clientId);

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    scope: OAUTH_CONFIG.scopes.join(' '),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: OAUTH_CONFIG.pkce.codeChallengeMethod,
  });

  const authUrl = `${OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;
  console.log('Full authorization URL:', authUrl);

  return authUrl;
}

/**
 * Parse OAuth callback URL parameters
 */
export function parseCallbackParams(url: string): {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
} {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;

  return {
    code: params.get('code') || undefined,
    state: params.get('state') || undefined,
    error: params.get('error') || undefined,
    error_description: params.get('error_description') || undefined,
  };
}

/**
 * OAuth Error Types
 */
export const OAuthErrors = {
  ACCESS_DENIED: 'access_denied',
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  SERVER_ERROR: 'server_error',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',

  // Client-side errors
  STATE_MISMATCH: 'state_mismatch',
  NO_CODE: 'no_code',
  NETWORK_ERROR: 'network_error',
  TOKEN_EXCHANGE_FAILED: 'token_exchange_failed',
} as const;

/**
 * Get user-friendly error message
 */
export function getOAuthErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    [OAuthErrors.ACCESS_DENIED]: 'You denied access to the application.',
    [OAuthErrors.INVALID_REQUEST]: 'The authorization request was invalid.',
    [OAuthErrors.UNAUTHORIZED_CLIENT]: 'This application is not authorized.',
    [OAuthErrors.UNSUPPORTED_RESPONSE_TYPE]: 'The authorization server does not support this response type.',
    [OAuthErrors.INVALID_SCOPE]: 'The requested scope is invalid or unsupported.',
    [OAuthErrors.SERVER_ERROR]: 'The authorization server encountered an error.',
    [OAuthErrors.TEMPORARILY_UNAVAILABLE]: 'The authorization server is temporarily unavailable.',
    [OAuthErrors.STATE_MISMATCH]: 'Invalid state parameter. Possible CSRF attack.',
    [OAuthErrors.NO_CODE]: 'No authorization code received.',
    [OAuthErrors.NETWORK_ERROR]: 'Network error during authentication.',
    [OAuthErrors.TOKEN_EXCHANGE_FAILED]:
      'The identity server did not accept the authorization code. Check OAUTH_CLIENT_SECRET in the app env (not a placeholder), that the redirect URL is registered for this client, and sign in again without reusing a bookmarked callback URL.',
  };

  return errorMessages[error] || 'An unknown error occurred during authentication.';
}
