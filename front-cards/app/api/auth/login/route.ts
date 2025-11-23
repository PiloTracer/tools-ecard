/**
 * OAuth Login Initiation API Route (Server-Side)
 *
 * Generates OAuth authorization URL with PKCE
 * Stores state and code_verifier in HTTP-only cookies (secure, AdGuard-proof)
 *
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

// OAuth configuration from environment variables
const OAUTH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID || 'ecards_app_dev',
  authorizationEndpoint: process.env.NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT || 'http://epicdev.com/oauth/authorize',
  redirectUri: process.env.OAUTH_REDIRECT_URI?.split(',')[0] || 'http://localhost:7300/oauth/complete',
  scopes: (process.env.OAUTH_SCOPES || 'profile email subscription').split(' '),
  pkceMethod: 'S256',
};

// Cookie configuration
const COOKIE_CONFIG = {
  state: {
    name: 'oauth_state',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
  },
  codeVerifier: {
    name: 'oauth_code_verifier',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
  },
};

/**
 * Generate cryptographically secure random string
 */
function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate code challenge from code verifier (SHA-256, base64url)
 */
function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return hash.toString('base64url'); // base64url encoding (no padding, URL-safe)
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== OAuth Login Initiation (Server-Side) ===');

    // Generate state for CSRF protection
    const state = generateRandomString(64);
    console.log('Generated state:', state.substring(0, 10) + '...');

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateRandomString(64);
    const codeChallenge = generateCodeChallenge(codeVerifier);
    console.log('Generated code_verifier:', codeVerifier.substring(0, 10) + '...');
    console.log('Generated code_challenge:', codeChallenge);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      scope: OAUTH_CONFIG.scopes.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: OAUTH_CONFIG.pkceMethod,
    });

    const authorizationUrl = `${OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;
    console.log('Authorization URL generated');
    console.log('Redirect URI:', OAUTH_CONFIG.redirectUri);

    // Create response with authorization URL
    const response = NextResponse.json({
      success: true,
      authorizationUrl,
    });

    // Store state and code_verifier in HTTP-only cookies
    response.cookies.set({
      name: COOKIE_CONFIG.state.name,
      value: state,
      httpOnly: COOKIE_CONFIG.state.httpOnly,
      secure: COOKIE_CONFIG.state.secure,
      sameSite: COOKIE_CONFIG.state.sameSite,
      path: COOKIE_CONFIG.state.path,
      maxAge: COOKIE_CONFIG.state.maxAge,
    });

    response.cookies.set({
      name: COOKIE_CONFIG.codeVerifier.name,
      value: codeVerifier,
      httpOnly: COOKIE_CONFIG.codeVerifier.httpOnly,
      secure: COOKIE_CONFIG.codeVerifier.secure,
      sameSite: COOKIE_CONFIG.codeVerifier.sameSite,
      path: COOKIE_CONFIG.codeVerifier.path,
      maxAge: COOKIE_CONFIG.codeVerifier.maxAge,
    });

    console.log('✓ PKCE data stored in HTTP-only cookies');
    console.log('=== Login Initiation Complete ===');

    return response;
  } catch (error) {
    console.error('Login initiation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate login',
      },
      { status: 500 }
    );
  }
}
