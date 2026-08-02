/**
 * Server-only OAuth config for /api/auth/* and app/oauth/complete.
 * The authorize step used NEXT_PUBLIC_OAUTH_CLIENT_ID while the token step used
 * OAUTH_CLIENT_ID; if they diverge, the server rejects the code. Prefer OAUTH_CLIENT_ID, same as token exchange.
 */

export function getOAuthRedirectUri(): string {
  const raw = process.env.OAUTH_REDIRECT_URI?.split(',')[0]?.trim();
  if (raw) return raw;
  return 'http://localhost:7300/oauth/complete';
}

export function getOAuthClientId(): string {
  return (
    process.env.OAUTH_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID?.trim() ||
    'ecards_app_dev'
  );
}

export function getOAuthClientSecret(): string | undefined {
  const s = process.env.OAUTH_CLIENT_SECRET?.trim();
  return s || undefined;
}

export function getTokenEndpoint(): string {
  return (
    process.env.OAUTH_TOKEN_ENDPOINT?.trim() ||
    process.env.NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT?.trim() ||
    'https://dev.aiepic.app/oauth/token'
  );
}

export function getUserInfoEndpoint(): string {
  return (
    process.env.OAUTH_USER_INFO_ENDPOINT?.trim() ||
    process.env.NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT?.trim() ||
    'https://dev.aiepic.app/api/users/me'
  );
}

export function getAuthorizationEndpoint(): string {
  return (
    process.env.NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT?.trim() ||
    'https://dev.aiepic.app/oauth/authorize'
  );
}

/**
 * Tools Dashboard home (app library). When the OAuth flow itself fails, users
 * are sent here instead of being stranded on an e-cards error screen — they
 * can sign in or manage apps directly at the provider.
 */
export function getToolsDashboardHomeUrl(): string {
  const sub =
    process.env.USER_SUBSCRIPTION_URL?.trim() ||
    process.env.NEXT_PUBLIC_USER_SUBSCRIPTION_URL?.trim() ||
    'https://dev.aiepic.app/app/features/user-subscription';
  try {
    return `${new URL(sub).origin}/app/features/app-library`;
  } catch {
    return 'https://dev.aiepic.app/app/features/app-library';
  }
}

export function getOAuthScopes(): string[] {
  // The Tools Dashboard client registration only supports 'profile' and 'email';
  // requesting anything else (e.g. the old 'subscription' scope) makes the
  // provider reject the authorize request and login fails outright.
  return (process.env.OAUTH_SCOPES || 'profile email')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
