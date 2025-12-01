/**
 * User Info API Route
 *
 * Fetches current user information using access token
 * GET /api/auth/user
 */

import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@/shared/types/auth';

// OAuth configuration from environment variables
const OAUTH_CONFIG = {
  userInfoEndpoint: process.env.OAUTH_USER_INFO_ENDPOINT || 'http://epicdev.com/api/users/me',
};

// Cookie configuration
const COOKIE_CONFIG = {
  accessToken: {
    name: process.env.SESSION_COOKIE_NAME || 'ecards_auth',
  },
};

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookie
    const accessToken = request.cookies.get(COOKIE_CONFIG.accessToken.name)?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch user information from Tools Dashboard
    const userResponse = await fetch(OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      // Token might be expired - client should try to refresh
      if (userResponse.status === 401) {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        );
      }

      console.error('Failed to fetch user info:', userResponse.status);
      return NextResponse.json(
        { error: 'Failed to fetch user information' },
        { status: userResponse.status }
      );
    }

    const user: User = await userResponse.json();

    return NextResponse.json(user);
  } catch (error) {
    console.error('User info fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
