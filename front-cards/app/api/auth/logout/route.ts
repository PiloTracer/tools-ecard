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

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear all authentication cookies
    response.cookies.delete(COOKIE_CONFIG.accessToken.name);
    response.cookies.delete(COOKIE_CONFIG.refreshToken.name);
    response.cookies.delete('user_id');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
