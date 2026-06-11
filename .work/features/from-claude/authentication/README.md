# Authentication

End-to-end session handling for E-Cards: OAuth 2.0 with PKCE on the **Next.js** app (BFF route handlers + cookies), client state via **React context**, and **Bearer cookie** validation on **api-server** for API calls.

## Overview

- **Browser → front-cards:** Login and callback pages; `POST /api/auth/login` starts PKCE; tokens stored in cookies; `GET /api/auth/user` resolves the current user from the remote userinfo endpoint.
- **Browser → api-server:** Same-site (or configured) requests include the access-token cookie; `authMiddleware` resolves `request.user` and syncs the user to PostgreSQL.
- **Long-form product/API spec:** [auto-auth.md](../auto-auth.md) and [auto-auth.external.md](../auto-auth.external.md).

## User stories

- As a user, I want to sign in with the organization OAuth provider and land on the dashboard.
- As a user, I want my session refreshed when possible without logging in again.
- As a user, I want to sign out and have cookies cleared.

## Key workflows

1. **Login:** User opens `/login` → client may call `POST /api/auth/login` → redirect to authorization server → callback stores tokens → redirect to app.
2. **Session check:** `AuthProvider` calls `GET /api/auth/user` (Next route); on 401, `POST /api/auth/refresh-token` may run.
3. **API calls:** `apiClient` uses `NEXT_PUBLIC_API_URL` and `credentials: 'include'` so **api-server** receives the session cookie; `authMiddleware` attaches `request.user`.

## Security considerations

- Prefer **httpOnly** cookies for OAuth state, verifier, and access token (see route handlers).
- Do not log access tokens or full userinfo payloads.
- Configure `OAUTH_USER_INFO_ENDPOINT`, `NEXT_PUBLIC_OAUTH_*`, `SESSION_COOKIE_NAME`, and CORS to match each environment (`DOCS_TECH_STACK.md`, `.env.*.example`).

## Related features

- **simple-projects:** default project ensured after user sync on the API.
