/**
 * Logout API Route
 *
 * Clears authentication cookies and logs user out
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';

// Cookie configuration
const COOKIE_CONFIG = {
  accessToken: {
    name: process.env.SESSION_COOKIE_NAME || 'ecards_auth',
  },
  refreshToken: {
    name: process.env.REFRESH_COOKIE_NAME || 'ecards_refresh',
  },
};

function clearAuthCookie(response: NextResponse, name: string, httpOnly: boolean) {
  response.cookies.delete(name);
  response.cookies.set({
    name,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear E-Cards session cookies (Tools Dashboard may still have its own browser session)
    clearAuthCookie(response, COOKIE_CONFIG.accessToken.name, true);
    clearAuthCookie(response, COOKIE_CONFIG.refreshToken.name, true);
    clearAuthCookie(response, 'user_id', false);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
