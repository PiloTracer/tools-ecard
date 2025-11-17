/**
 * OAuth Token Refresh API Route
 *
 * Refreshes access token using refresh token
 * POST /api/auth/refresh-token
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RefreshTokenResponse, OAuthTokenResponse } from '@/shared/types/auth';

// OAuth configuration from environment variables
const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID || 'ecards_app_dev',
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT || 'http://epicdev.com/oauth/token',
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
    // Get refresh token from cookie
    const refreshToken = request.cookies.get(COOKIE_CONFIG.refreshToken.name)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token found' },
        { status: 401 }
      );
    }

    // Validate client secret is configured
    if (!OAUTH_CONFIG.clientSecret) {
      console.error('OAUTH_CLIENT_SECRET is not configured');
      return NextResponse.json(
        { success: false, error: 'OAuth is not properly configured' },
        { status: 500 }
      );
    }

    // Request new access token using refresh token
    const tokenResponse = await fetch(OAUTH_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token refresh failed:', errorData);

      // Clear cookies on refresh failure
      const response = NextResponse.json<RefreshTokenResponse>(
        {
          success: false,
          error: 'Token refresh failed. Please log in again.',
        },
        { status: 401 }
      );

      response.cookies.delete(COOKIE_CONFIG.accessToken.name);
      response.cookies.delete(COOKIE_CONFIG.refreshToken.name);
      response.cookies.delete('user_id');

      return response;
    }

    const tokens: OAuthTokenResponse = await tokenResponse.json();

    // Create response with updated tokens
    const response = NextResponse.json<RefreshTokenResponse>({
      success: true,
    });

    // Update access token cookie
    response.cookies.set({
      name: COOKIE_CONFIG.accessToken.name,
      value: tokens.access_token,
      httpOnly: COOKIE_CONFIG.accessToken.httpOnly,
      secure: COOKIE_CONFIG.accessToken.secure,
      sameSite: COOKIE_CONFIG.accessToken.sameSite,
      path: COOKIE_CONFIG.accessToken.path,
      maxAge: tokens.expires_in,
    });

    // Update refresh token cookie (may have been rotated)
    if (tokens.refresh_token) {
      response.cookies.set({
        name: COOKIE_CONFIG.refreshToken.name,
        value: tokens.refresh_token,
        httpOnly: COOKIE_CONFIG.refreshToken.httpOnly,
        secure: COOKIE_CONFIG.refreshToken.secure,
        sameSite: COOKIE_CONFIG.refreshToken.sameSite,
        path: COOKIE_CONFIG.refreshToken.path,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
