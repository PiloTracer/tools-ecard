/**
 * OAuth Token Exchange API Route
 *
 * Exchanges authorization code for access token (backend-only for security)
 * POST /api/auth/exchange-token
 */

import { NextRequest, NextResponse } from 'next/server';
import type { TokenExchangeRequest, TokenExchangeResponse, OAuthTokenResponse, User } from '@/shared/types/auth';

// OAuth configuration from environment variables
const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID || 'ecards_app_dev',
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'http://epicdev.com/oauth/token',
  userInfoEndpoint: process.env.OAUTH_USER_INFO_ENDPOINT || 'http://epicdev.com/api/users/me',
  redirectUri: process.env.OAUTH_REDIRECT_URI?.split(',')[0] || 'http://localhost:7300/auth/callback',
};

// Cookie configuration
const COOKIE_CONFIG = {
  accessToken: {
    name: process.env.SESSION_COOKIE_NAME || 'ecards_auth',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
  refreshToken: {
    name: process.env.REFRESH_COOKIE_NAME || 'ecards_refresh',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
};

export async function POST(request: NextRequest) {
  try {
    console.log('=== Token Exchange API Started ===');

    // Parse request body
    const body: TokenExchangeRequest = await request.json();
    const { code, codeVerifier } = body;

    const flowType = codeVerifier ? 'Manual Login (with PKCE)' : 'Pre-Initiated OAuth (no PKCE)';
    console.log('Flow type:', flowType);
    console.log('Received token exchange request:', {
      code: code ? `${code.substring(0, 10)}...` : 'MISSING',
      codeVerifier: codeVerifier ? `${codeVerifier.substring(0, 10)}...` : 'NOT PROVIDED (pre-initiated flow)',
    });

    // Validate required fields
    if (!code) {
      console.error('Validation failed: No authorization code provided');
      return NextResponse.json(
        { success: false, error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    // Note: codeVerifier is optional
    // - For manual login: codeVerifier is provided (PKCE flow)
    // - For pre-initiated OAuth: codeVerifier is NOT provided (Tools Dashboard handles PKCE on their end)

    // Validate client secret is configured
    if (!OAUTH_CONFIG.clientSecret) {
      console.error('OAUTH_CLIENT_SECRET is not configured in environment');
      return NextResponse.json(
        { success: false, error: 'OAuth is not properly configured' },
        { status: 500 }
      );
    }

    console.log('✓ Validation passed');

    // Exchange authorization code for access token
    console.log('Exchanging code for token with OAuth server...');
    console.log('Token endpoint:', OAUTH_CONFIG.tokenEndpoint);
    console.log('Client ID:', OAUTH_CONFIG.clientId);
    console.log('Redirect URI:', OAUTH_CONFIG.redirectUri);

    // Build token request body
    // Note: code_verifier is only included for manual login flows (PKCE)
    // For pre-initiated flows, it's omitted (Tools Dashboard validates on their end)
    const tokenRequestBody: any = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
    };

    // Include code_verifier only if provided (manual login flow)
    if (codeVerifier) {
      tokenRequestBody.code_verifier = codeVerifier;
      console.log('Including code_verifier for PKCE validation');
    } else {
      console.log('Skipping code_verifier (pre-initiated OAuth flow)');
    }

    console.log('Token request body (without secret):', {
      ...tokenRequestBody,
      client_secret: '***REDACTED***',
      code_verifier: codeVerifier ? codeVerifier.substring(0, 10) + '...' : 'NOT INCLUDED',
    });

    const tokenResponse = await fetch(OAUTH_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenRequestBody),
    });

    console.log('Token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange failed!');
      console.error('Error data:', errorData);
      console.error('Response status:', tokenResponse.status);
      console.error('Response statusText:', tokenResponse.statusText);
      return NextResponse.json(
        {
          success: false,
          error: errorData.error_description || errorData.error || 'Token exchange failed',
        },
        { status: tokenResponse.status }
      );
    }

    const tokens: OAuthTokenResponse = await tokenResponse.json();
    console.log('✓ Token exchange successful!');
    console.log('Received tokens:', {
      access_token: tokens.access_token ? `${tokens.access_token.substring(0, 10)}...` : 'MISSING',
      refresh_token: tokens.refresh_token ? 'present' : 'MISSING',
      expires_in: tokens.expires_in,
      scope: tokens.scope,
    });

    // Fetch user information
    console.log('Fetching user information...');
    console.log('User info endpoint:', OAUTH_CONFIG.userInfoEndpoint);

    const userResponse = await fetch(OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    console.log('User info response status:', userResponse.status);

    if (!userResponse.ok) {
      console.error('Failed to fetch user info!');
      console.error('Response status:', userResponse.status);
      console.error('Response statusText:', userResponse.statusText);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user information' },
        { status: userResponse.status }
      );
    }

    const user: User = await userResponse.json();
    console.log('✓ User info fetched successfully!');
    console.log('User:', {
      id: user.id,
      username: user.username,
      email: user.email,
      subscription: user.subscription?.tier,
    });

    // Create response with secure cookies
    console.log('Setting secure cookies...');

    const response = NextResponse.json<TokenExchangeResponse>({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });

    // Set access token cookie
    console.log('Setting access token cookie:', COOKIE_CONFIG.accessToken.name);
    response.cookies.set({
      name: COOKIE_CONFIG.accessToken.name,
      value: tokens.access_token,
      httpOnly: COOKIE_CONFIG.accessToken.httpOnly,
      secure: COOKIE_CONFIG.accessToken.secure,
      sameSite: COOKIE_CONFIG.accessToken.sameSite,
      path: COOKIE_CONFIG.accessToken.path,
      maxAge: tokens.expires_in, // Use expiry from token response
    });

    // Set refresh token cookie
    console.log('Setting refresh token cookie:', COOKIE_CONFIG.refreshToken.name);
    response.cookies.set({
      name: COOKIE_CONFIG.refreshToken.name,
      value: tokens.refresh_token,
      httpOnly: COOKIE_CONFIG.refreshToken.httpOnly,
      secure: COOKIE_CONFIG.refreshToken.secure,
      sameSite: COOKIE_CONFIG.refreshToken.sameSite,
      path: COOKIE_CONFIG.refreshToken.path,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Set user ID cookie (non-httpOnly for client-side access)
    console.log('Setting user ID cookie: user_id');
    response.cookies.set({
      name: 'user_id',
      value: user.id,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    console.log('✓ All cookies set successfully!');
    console.log('=== Token Exchange Complete ===');

    return response;
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
