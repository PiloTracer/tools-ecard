/**
 * OAuth Callback Route (Server-Side)
 *
 * Handles OAuth 2.0 callback with server-side redirect
 * - No JavaScript execution (bypasses ad blockers like AdGuard)
 * - Validates state and exchanges code for tokens
 * - Sets HTTP-only cookies and redirects to dashboard
 *
 * GET /oauth/complete?code=...&state=...
 */

import { NextRequest, NextResponse } from 'next/server';
import type { OAuthTokenResponse, User } from '@/shared/types/auth';

// OAuth configuration from environment variables
const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID || 'ecards_app_dev',
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'http://epicdev.com/oauth/token',
  userInfoEndpoint: process.env.OAUTH_USER_INFO_ENDPOINT || 'http://epicdev.com/api/users/me',
  redirectUri: process.env.OAUTH_REDIRECT_URI?.split(',')[0] || 'http://localhost:7300/oauth/complete',
};

// Get the correct base URL (using redirect URI's origin to ensure correct port)
const getBaseUrl = () => {
  const url = new URL(OAUTH_CONFIG.redirectUri);
  return url.origin; // e.g., http://localhost:7300
};

// Cookie configuration
const COOKIE_CONFIG = {
  accessToken: {
    name: process.env.SESSION_COOKIE_NAME || 'ecards_auth',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
  refreshToken: {
    name: process.env.REFRESH_COOKIE_NAME || 'ecards_refresh',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
  // PKCE data cookies (for manual login flow)
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

export async function GET(request: NextRequest) {
  try {
    console.log('=== Server-Side OAuth Callback Started ===');
    console.log('Request URL:', request.url);

    // Get URL parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const receivedState = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('URL Parameters:', {
      code: code ? `${code.substring(0, 10)}...` : 'MISSING',
      state: receivedState ? `${receivedState.substring(0, 10)}...` : 'MISSING',
      error,
      errorDescription,
    });

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error received:', error, errorDescription);
      return NextResponse.redirect(
        `${getBaseUrl()}/login?error=${error}&description=${encodeURIComponent(errorDescription || '')}`
      );
    }

    // Validate authorization code
    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(`${getBaseUrl()}/login?error=no_code`);
    }

    // Validate client secret is configured
    if (!OAUTH_CONFIG.clientSecret) {
      console.error('OAUTH_CLIENT_SECRET is not configured in environment');
      return NextResponse.redirect(`${getBaseUrl()}/login?error=server_misconfigured`);
    }

    // Determine flow type and validate state/PKCE
    const storedState = request.cookies.get(COOKIE_CONFIG.state.name)?.value;
    const storedCodeVerifier = request.cookies.get(COOKIE_CONFIG.codeVerifier.name)?.value;

    // Check if this is a manual login flow (state matches)
    const isManualLogin = storedState && receivedState && storedState === receivedState;

    console.log('Flow Detection:', {
      storedState: storedState ? `${storedState.substring(0, 10)}...` : 'NOT FOUND',
      receivedState: receivedState ? `${receivedState.substring(0, 10)}...` : 'NOT PROVIDED',
      statesMatch: isManualLogin,
      flowType: isManualLogin ? 'Manual Login (PKCE)' : 'Pre-Initiated OAuth',
    });

    let codeVerifier: string | undefined;

    if (isManualLogin) {
      // Manual login flow - validate PKCE
      console.log('Manual login flow detected');

      if (!storedCodeVerifier) {
        console.error('No code verifier found in cookies for manual login');
        return NextResponse.redirect(`${getBaseUrl()}/login?error=missing_code_verifier`);
      }

      codeVerifier = storedCodeVerifier;
      console.log('✓ Code verifier found:', codeVerifier.substring(0, 10) + '...');
    } else {
      // Pre-initiated OAuth flow - no PKCE required
      console.log('✓ Pre-initiated OAuth flow - no PKCE validation needed');
    }

    console.log('✓ Validation passed');

    // Exchange authorization code for access token
    console.log('Exchanging authorization code for access token...');
    console.log('Token endpoint:', OAUTH_CONFIG.tokenEndpoint);

    const tokenRequestBody: Record<string, string> = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
    };

    // Include code_verifier only if manual login
    if (codeVerifier) {
      tokenRequestBody.code_verifier = codeVerifier;
      console.log('Including code_verifier for PKCE validation');
    }

    const tokenResponse = await fetch(OAUTH_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenRequestBody),
    });

    console.log('Token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${getBaseUrl()}/login?error=token_exchange_failed&description=${encodeURIComponent(errorData.error_description || '')}`
      );
    }

    const tokens: OAuthTokenResponse = await tokenResponse.json();
    console.log('✓ Token exchange successful!');

    // Fetch user information
    console.log('Fetching user information...');
    const userResponse = await fetch(OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    console.log('User info response status:', userResponse.status);

    if (!userResponse.ok) {
      console.error('Failed to fetch user info:', userResponse.status);
      return NextResponse.redirect(`${getBaseUrl()}/login?error=user_info_failed`);
    }

    const user: User = await userResponse.json();
    console.log('✓ User info fetched:', {
      id: user.id,
      username: user.username,
      email: user.email,
    });

    // Create redirect response to dashboard
    console.log('Setting cookies and redirecting to dashboard...');
    // Use the OAuth redirect URI's origin to ensure correct port (7300, not Docker's internal 3000)
    const dashboardUrl = OAUTH_CONFIG.redirectUri.replace(/\/oauth\/complete$/, '/dashboard');
    console.log('Redirecting to:', dashboardUrl);
    const redirectResponse = NextResponse.redirect(dashboardUrl);

    // Set access token cookie
    redirectResponse.cookies.set({
      name: COOKIE_CONFIG.accessToken.name,
      value: tokens.access_token,
      httpOnly: COOKIE_CONFIG.accessToken.httpOnly,
      secure: COOKIE_CONFIG.accessToken.secure,
      sameSite: COOKIE_CONFIG.accessToken.sameSite,
      path: COOKIE_CONFIG.accessToken.path,
      maxAge: tokens.expires_in,
    });

    // Set refresh token cookie
    redirectResponse.cookies.set({
      name: COOKIE_CONFIG.refreshToken.name,
      value: tokens.refresh_token,
      httpOnly: COOKIE_CONFIG.refreshToken.httpOnly,
      secure: COOKIE_CONFIG.refreshToken.secure,
      sameSite: COOKIE_CONFIG.refreshToken.sameSite,
      path: COOKIE_CONFIG.refreshToken.path,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Set user ID cookie (non-httpOnly for client-side access)
    redirectResponse.cookies.set({
      name: 'user_id',
      value: user.id,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Clear PKCE cookies (if they exist)
    redirectResponse.cookies.delete(COOKIE_CONFIG.state.name);
    redirectResponse.cookies.delete(COOKIE_CONFIG.codeVerifier.name);

    console.log('✓ All cookies set successfully!');
    console.log('=== Server-Side OAuth Complete - Redirecting to /dashboard ===');

    return redirectResponse;
  } catch (err) {
    console.error('=== OAuth Callback Error ===');
    console.error('Error:', err);
    console.error('Stack trace:', err instanceof Error ? err.stack : 'N/A');
    return NextResponse.redirect(
      `${getBaseUrl()}/login?error=server_error&description=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')}`
    );
  }
}
