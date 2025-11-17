# Auto-Auth Feature

**Status:** In Progress
**Priority:** High
**Owner:** TBD

---

## Table of Contents

1. [User Story](#user-story)
2. [Acceptance Criteria](#acceptance-criteria)
3. [Architecture Overview](#architecture-overview)
4. [Security Model](#security-model)
5. [User Flow](#user-flow)
6. [Technical Implementation](#technical-implementation)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Frontend Components](#frontend-components)
10. [Configuration](#configuration)
11. [Testing Strategy](#testing-strategy)
12. [Error Handling](#error-handling)
13. [Performance Considerations](#performance-considerations)

---

## User Story

**As a** user authenticated in the remote application (http://epicdev.com/app)
**I want to** be automatically authenticated when accessing the E-Cards application
**So that** I can seamlessly use E-Cards without re-entering credentials

### Remote Systems Integration

**Important:** This feature integrates with **two remote applications**:

1. **User App** (`http://epicdev.com/app`)
   - User-facing application where users work daily
   - Contains "E-Cards" button to launch E-Cards
   - Hosts OAuth 2.0 Authorization Server for authentication
   - Handles user login and consent screens

2. **Admin API** (`http://epicdev.com/admin`)
   - Backend API for administrative operations
   - Provides user profile, subscription, and rate limit data
   - Receives usage reports from E-Cards
   - Sends real-time updates via WebSocket

**See `.claude/features/auto-auth.external.md` for complete external system specifications.**

---

## Acceptance Criteria

### Must Have
- [x] User authenticated in remote app can click "E-Cards" button
- [x] New tab opens to http://localhost:7300/ (or production URL)
- [x] Landing page displays with "Sign In" and "Subscribe" buttons
- [x] Clicking "Sign In" automatically authenticates user if remote session valid
- [x] System verifies user identity with remote auth service
- [x] System fetches user data (profile, subscription, limits)
- [x] System validates subscription allows E-Cards access
- [x] System enforces rate limits based on subscription tier
- [x] User is redirected to dashboard upon successful auth
- [x] If remote session invalid/expired, redirect to remote login page
- [x] Secure token exchange using OAuth 2.0 + PKCE
- [x] CSRF protection via state parameter
- [x] Token refresh mechanism for long sessions

### Should Have
- [ ] Remember device/browser for 30 days (optional re-auth skip)
- [ ] Multi-factor authentication support if required by remote app
- [ ] Audit logging of all authentication events
- [ ] Rate limiting on auth endpoints (prevent brute force)

### Nice to Have
- [ ] Social login fallback (Google, Microsoft) if remote auth unavailable
- [ ] Offline mode with cached credentials (read-only)
- [ ] Biometric authentication support (WebAuthn)

---

## Architecture Overview

### Components

```
┌─────────────────────────────────────────────────────────────┐
│          Remote User App (epicdev.com/app)                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  User Dashboard                                    │     │
│  │  ┌──────────────┐                                  │     │
│  │  │  [E-Cards]   │ ← User clicks this button        │     │
│  │  └──────────────┘                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                          │                                  │
│  OAuth 2.0 Server:       │                                  │
│  - /oauth/authorize      │ Initiates OAuth 2.0 flow        │
│  - /oauth/token          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              E-Cards Frontend (localhost:7300)              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Landing Page                                      │     │
│  │  ┌──────────────┐  ┌──────────────┐               │     │
│  │  │  [Sign In]   │  │ [Subscribe]  │               │     │
│  │  └──────────────┘  └──────────────┘               │     │
│  └────────────────────────────────────────────────────┘     │
│                          │                                  │
│                          │ User clicks "Sign In"           │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Auto-Auth Handler (/auth/callback)               │     │
│  │  - Verify state parameter (CSRF)                  │     │
│  │  - Exchange auth code for tokens (PKCE)           │     │
│  │  - Store tokens securely                          │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           │ REST API calls with JWT
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              E-Cards API Server (localhost:7400)            │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Auth Middleware                                   │     │
│  │  - Validate JWT signature                          │     │
│  │  - Verify token expiry                             │     │
│  │  - Extract user claims                             │     │
│  └────────────────────────────────────────────────────┘     │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  User Verification Service                         │     │
│  │  - Exchange OAuth code (→ User App)                │     │
│  │  - Fetch user profile (→ Admin API)                │     │
│  │  - Fetch subscription (→ Admin API)                │     │
│  │  - Check rate limits (→ Admin API)                 │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           │ Backend-to-backend HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Remote Systems (epicdev.com)                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  User App (epicdev.com/app)                         │   │
│  │  OAuth 2.0 Server:                                  │   │
│  │  - POST /oauth/token (token exchange)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Admin API (epicdev.com/admin)                      │   │
│  │  - GET  /api/users/:userId (profile)                │   │
│  │  - GET  /api/users/:userId/subscription             │   │
│  │  - GET  /api/users/:userId/limits (rate limits)     │   │
│  │  - POST /api/users/:userId/verify (permissions)     │   │
│  │  - WebSocket /ws (real-time updates)                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Model

### OAuth 2.0 Authorization Code Flow + PKCE

**Why OAuth 2.0 + PKCE?**
- Industry-standard authentication protocol
- PKCE (Proof Key for Code Exchange) prevents authorization code interception
- Secure for both server-side and client-side (SPA) applications
- Supports token refresh for long-lived sessions

**Flow Steps:**

1. **User initiates login** → E-Cards generates:
   - `code_verifier`: Random 43-128 character string
   - `code_challenge`: Base64URL(SHA256(code_verifier))
   - `state`: Random CSRF token

2. **Redirect to remote auth** with parameters:
   ```
   http://epicdev.com/oauth/authorize?
     client_id=ecards_app
     &redirect_uri=http://localhost:7300/auth/callback
     &response_type=code
     &scope=profile email subscription
     &state=RANDOM_STATE_TOKEN
     &code_challenge=BASE64_HASH
     &code_challenge_method=S256
   ```

3. **User authenticates** on remote app (or already authenticated)

4. **Remote app redirects back** to E-Cards with:
   ```
   http://localhost:7300/auth/callback?
     code=AUTH_CODE_HERE
     &state=RANDOM_STATE_TOKEN
   ```

5. **E-Cards validates**:
   - State matches (CSRF protection)
   - Code is present and not expired

6. **Exchange code for tokens** (backend-to-backend):
   ```http
   POST http://epicdev.com/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code=AUTH_CODE_HERE
   &redirect_uri=http://localhost:7300/auth/callback
   &client_id=ecards_app
   &client_secret=ECARDS_CLIENT_SECRET
   &code_verifier=ORIGINAL_CODE_VERIFIER
   ```

7. **Receive tokens**:
   ```json
   {
     "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "scope": "profile email subscription"
   }
   ```

8. **Validate and store**:
   - Verify JWT signature using remote public key
   - Extract user ID, email, roles
   - Store access_token in httpOnly cookie
   - Store refresh_token in secure backend storage
   - Create E-Cards session

### Token Storage Strategy

**Access Token** (Short-lived: 1 hour)
- **Client**: HttpOnly, Secure, SameSite=Strict cookie
- **Purpose**: Authenticate API requests
- **No localStorage/sessionStorage** (XSS vulnerability)

**Refresh Token** (Long-lived: 30 days)
- **Server**: Encrypted in PostgreSQL with user_id foreign key
- **Purpose**: Obtain new access tokens without re-login
- **Rotation**: New refresh token issued on each use (prevents reuse)

**PKCE Code Verifier**
- **Client**: sessionStorage (temporary, cleared after exchange)
- **Purpose**: Prove authorization code ownership

**State Token**
- **Client**: sessionStorage (temporary)
- **Purpose**: CSRF protection

### CSRF Protection

- Every auth initiation generates random `state` parameter
- State stored in sessionStorage before redirect
- On callback, server validates state matches
- Prevents malicious authorization code injection

### XSS Protection

- All user input sanitized (DOMPurify)
- Content Security Policy (CSP) headers
- No `eval()` or `Function()` usage
- HttpOnly cookies prevent JavaScript access

### Rate Limiting

**Auth Endpoints:**
- `/auth/login`: 5 attempts per 15 minutes per IP
- `/auth/callback`: 10 attempts per 15 minutes per IP
- `/auth/refresh`: 20 attempts per hour per user

**API Endpoints:**
- Based on subscription tier (see CONTEXT.md)

---

## User Flow

### Scenario 1: First-Time User (Happy Path)

```
1. User authenticated in Remote App (epicdev.com)
2. User clicks "E-Cards" button in Remote App dashboard
3. Browser opens new tab → http://localhost:7300/
4. Landing page loads with hero section
   - Shows E-Cards features/benefits
   - Two prominent buttons: [Sign In] [Subscribe]
5. User clicks [Sign In]
6. Frontend detects no active session
7. Frontend generates PKCE code_verifier + code_challenge
8. Frontend generates random state token
9. Frontend stores code_verifier and state in sessionStorage
10. Frontend redirects to:
    http://epicdev.com/oauth/authorize?client_id=ecards&...
11. Remote App detects user already authenticated (via cookie)
12. Remote App shows consent screen (optional, first time only):
    "E-Cards wants to access your profile and subscription info"
    [Allow] [Deny]
13. User clicks [Allow]
14. Remote App redirects to:
    http://localhost:7300/auth/callback?code=ABC123&state=XYZ789
15. E-Cards /auth/callback page loads
16. Frontend validates state matches sessionStorage
17. Frontend sends code + code_verifier to backend:
    POST /api/auth/verify-code
18. Backend exchanges code for tokens (server-to-server)
19. Backend validates JWT signature
20. Backend calls Remote API:
    - GET /api/users/:userId (profile)
    - GET /api/users/:userId/subscription (tier, limits)
    - GET /api/users/:userId/rate-limits (current usage)
21. Backend creates E-Cards user record (if not exists)
22. Backend generates E-Cards session token (JWT)
23. Backend stores refresh_token encrypted in PostgreSQL
24. Backend sets access_token as httpOnly cookie
25. Backend returns success response with user data
26. Frontend redirects to /dashboard
27. Dashboard loads with user's templates and batches
```

### Scenario 2: Returning User (Fast Auth)

```
1. User clicks "E-Cards" in Remote App
2. New tab opens → http://localhost:7300/
3. Landing page loads
4. User clicks [Sign In]
5. Frontend detects valid access_token cookie
6. Frontend sends GET /api/auth/me (with cookie)
7. Backend validates token, returns user data
8. Frontend redirects to /dashboard (NO OAuth redirect needed)
```

### Scenario 3: Expired Session (Token Refresh)

```
1. User on /dashboard, access_token expired (1 hour passed)
2. Frontend makes API call → GET /api/batches
3. Backend returns 401 Unauthorized (token expired)
4. Frontend intercepts 401 error
5. Frontend calls POST /api/auth/refresh (refresh_token in cookie)
6. Backend validates refresh_token
7. Backend calls Remote API: POST /oauth/token (grant_type=refresh_token)
8. Backend receives new access_token + refresh_token
9. Backend rotates refresh_token (invalidates old, stores new)
10. Backend sets new access_token cookie
11. Backend returns success
12. Frontend retries original API call → GET /api/batches
13. Request succeeds with new token
```

### Scenario 4: Invalid Remote Session (Redirect to Login)

```
1. User clicks "E-Cards" in Remote App
2. New tab opens → http://localhost:7300/
3. User clicks [Sign In]
4. Frontend redirects to Remote OAuth
5. Remote App detects NO valid session (cookie expired/deleted)
6. Remote App redirects to Login Page:
   http://epicdev.com/login?returnUrl=/oauth/authorize?...
7. User enters username + password
8. Remote App authenticates user
9. Remote App redirects to OAuth authorize page
10. User consents (if needed)
11. Flow continues from step 14 of Scenario 1
```

### Scenario 5: Subscription Validation Failure

```
1-18. Same as Scenario 1 (OAuth flow succeeds)
19. Backend calls GET /api/users/:userId/subscription
20. Response: { tier: "free", ecards_enabled: false }
21. Backend detects user's subscription does NOT include E-Cards
22. Backend logs audit event: "ACCESS_DENIED - No subscription"
23. Backend returns 403 Forbidden with error:
    { error: "subscription_required", message: "Please upgrade..." }
24. Frontend displays error page:
    "E-Cards access requires a subscription"
    [Upgrade Now] [Contact Support]
25. User clicks [Upgrade Now]
26. Frontend redirects to Remote App subscription page:
    http://epicdev.com/account/subscription?upgrade=ecards
```

### Scenario 6: Rate Limit Exceeded

```
1-20. User successfully authenticated
21. Backend calls GET /api/users/:userId/rate-limits
22. Response: { cards_per_month: 100, current_usage: 100, reset_date: "2025-12-01" }
23. Backend detects user at limit
24. Backend allows READ operations (view templates, batches)
25. Backend blocks CREATE operations (new batch)
26. User tries to create batch → POST /api/batches
27. Backend returns 429 Too Many Requests:
    { error: "rate_limit_exceeded", limit: 100, reset_date: "..." }
28. Frontend displays banner:
    "You've reached your monthly limit (100 cards). Resets on Dec 1."
    [Upgrade Plan]
```

---

## Technical Implementation

### Frontend Architecture

**Directory Structure:**
```
/front-cards
  /features
    /auto-auth
      /components
        LandingPage.tsx          # Home page with Sign In button
        AuthCallback.tsx         # /auth/callback handler
        AuthGuard.tsx            # Protected route wrapper
        SubscriptionError.tsx    # Subscription error display
        RateLimitBanner.tsx      # Rate limit warning
      /hooks
        useAuth.ts               # Main auth hook
        useOAuthFlow.ts          # OAuth PKCE logic
        useTokenRefresh.ts       # Auto token refresh
      /services
        authService.ts           # API client for auth
        pkceService.ts           # PKCE helper functions
        tokenStorage.ts          # Cookie/storage management
      /types
        auth.types.ts            # TypeScript types
      /utils
        validators.ts            # Token validation
        crypto.ts                # PKCE code generation
      index.ts
      README.md
```

**Key Components:**

#### 1. LandingPage.tsx
```tsx
import { useAuth } from './hooks/useAuth';
import { useOAuthFlow } from './hooks/useOAuthFlow';

export function LandingPage() {
  const { user, isAuthenticated } = useAuth();
  const { initiateLogin } = useOAuthFlow();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated]);

  return (
    <div className="landing-page">
      <header>
        <h1>E-Cards System</h1>
        <p>Create personalized cards at scale</p>
      </header>

      <section className="features">
        {/* Feature highlights */}
      </section>

      <section className="cta">
        <button onClick={initiateLogin} className="btn-primary">
          Sign In
        </button>
        <button onClick={() => window.open('http://epicdev.com/subscribe')}
                className="btn-secondary">
          Subscribe
        </button>
      </section>
    </div>
  );
}
```

#### 2. useOAuthFlow.ts
```tsx
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/crypto';

export function useOAuthFlow() {
  const initiateLogin = async () => {
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store for later verification
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID!,
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: 'code',
      scope: 'profile email subscription',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${process.env.NEXT_PUBLIC_EXTERNAL_AUTH_URL}/oauth/authorize?${params}`;
    window.location.href = authUrl;
  };

  return { initiateLogin };
}
```

#### 3. AuthCallback.tsx
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '../services/authService';

export function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      // Handle OAuth errors
      if (errorParam) {
        setError(errorParam);
        return;
      }

      // Validate parameters
      if (!code || !state) {
        setError('Missing authorization code or state');
        return;
      }

      // Validate state (CSRF protection)
      const storedState = sessionStorage.getItem('oauth_state');
      if (state !== storedState) {
        setError('State mismatch - possible CSRF attack');
        return;
      }

      // Get code verifier
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
      if (!codeVerifier) {
        setError('Missing code verifier');
        return;
      }

      try {
        // Exchange code for tokens
        const result = await authService.exchangeCode({
          code,
          codeVerifier,
          redirectUri: `${window.location.origin}/auth/callback`,
        });

        // Clear session storage
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_code_verifier');

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (err: any) {
        setError(err.message || 'Authentication failed');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="auth-error">
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <button onClick={() => router.push('/')}>Return to Home</button>
      </div>
    );
  }

  return (
    <div className="auth-loading">
      <div className="spinner" />
      <p>Completing authentication...</p>
    </div>
  );
}
```

#### 4. useAuth.ts
```tsx
import { create } from 'zustand';
import { authService } from '../services/authService';
import type { User } from '../types/auth.types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    isLoading: false
  }),

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.getCurrentUser();
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch (error: any) {
      set({ user: null, isAuthenticated: false, isLoading: false, error: error.message });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
      set({ user: null, isAuthenticated: false });
    } catch (error: any) {
      set({ error: error.message });
    }
  },
}));
```

#### 5. authService.ts
```typescript
import type { User, ExchangeCodeParams, VerifyResult } from '../types/auth.types';

class AuthService {
  private apiUrl = process.env.NEXT_PUBLIC_API_URL;

  async exchangeCode(params: ExchangeCodeParams): Promise<VerifyResult> {
    const response = await fetch(`${this.apiUrl}/api/auth/exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Code exchange failed');
    }

    return response.json();
  }

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${this.apiUrl}/api/auth/me`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.getCurrentUser(); // Retry
        }
      }
      throw new Error('Not authenticated');
    }

    return response.json();
  }

  async refreshToken(): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    return response.ok;
  }

  async logout(): Promise<void> {
    await fetch(`${this.apiUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  }
}

export const authService = new AuthService();
```

#### 6. crypto.ts (PKCE helpers)
```typescript
/**
 * Generate a cryptographically random code verifier for PKCE
 * @returns Base64URL encoded random string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generate code challenge from verifier using SHA-256
 * @param verifier - The code verifier
 * @returns Base64URL encoded SHA-256 hash
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(hash));
}

/**
 * Generate random state token for CSRF protection
 * @returns Base64URL encoded random string
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

### Backend Architecture

**Directory Structure:**
```
/api-server
  /src
    /features
      /auto-auth
        /controllers
          authController.ts       # HTTP request handlers
        /services
          oauthService.ts         # OAuth token exchange
          userVerificationService.ts  # Remote API calls
          tokenService.ts         # JWT validation & refresh
        /middleware
          authMiddleware.ts       # Protect routes
          rateLimitMiddleware.ts  # Rate limiting
        /models
          userSession.model.ts    # PostgreSQL session model
        /types
          auth.types.ts
        /utils
          jwtValidator.ts
        index.ts
```

**Key Services:**

#### 1. authController.ts
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { oauthService } from '../services/oauthService';
import { userVerificationService } from '../services/userVerificationService';
import { tokenService } from '../services/tokenService';

export class AuthController {
  /**
   * POST /api/auth/exchange-code
   * Exchange authorization code for tokens
   */
  async exchangeCode(req: FastifyRequest, reply: FastifyReply) {
    const { code, codeVerifier, redirectUri } = req.body as {
      code: string;
      codeVerifier: string;
      redirectUri: string;
    };

    try {
      // 1. Exchange code for tokens (backend-to-backend)
      const tokens = await oauthService.exchangeAuthorizationCode({
        code,
        codeVerifier,
        redirectUri,
      });

      // 2. Validate JWT signature
      const payload = await tokenService.validateAccessToken(tokens.access_token);

      // 3. Verify user with remote API
      const userProfile = await userVerificationService.fetchUserProfile(payload.sub);
      const subscription = await userVerificationService.fetchSubscription(payload.sub);
      const rateLimits = await userVerificationService.fetchRateLimits(payload.sub);

      // 4. Validate subscription allows E-Cards access
      if (!subscription.ecards_enabled) {
        return reply.code(403).send({
          error: 'subscription_required',
          message: 'Your subscription does not include E-Cards access',
        });
      }

      // 5. Create/update user in E-Cards database
      const user = await userVerificationService.syncUser({
        externalId: payload.sub,
        email: userProfile.email,
        name: userProfile.name,
        subscription: subscription.tier,
        rateLimits,
      });

      // 6. Store refresh token encrypted
      await tokenService.storeRefreshToken(user.id, tokens.refresh_token);

      // 7. Set access token as httpOnly cookie
      reply.setCookie('access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: tokens.expires_in,
        path: '/',
      });

      // 8. Return user data
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subscription: user.subscription,
        },
      });
    } catch (error: any) {
      req.log.error({ error }, 'Code exchange failed');
      return reply.code(401).send({
        error: 'authentication_failed',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/auth/me
   * Get current user from token
   */
  async getCurrentUser(req: FastifyRequest, reply: FastifyReply) {
    try {
      const token = req.cookies.access_token;
      if (!token) {
        return reply.code(401).send({ error: 'no_token' });
      }

      const payload = await tokenService.validateAccessToken(token);
      const user = await userVerificationService.getUserById(payload.sub);

      return reply.send({ user });
    } catch (error: any) {
      return reply.code(401).send({ error: 'invalid_token' });
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  async refreshToken(req: FastifyRequest, reply: FastifyReply) {
    try {
      const oldAccessToken = req.cookies.access_token;
      if (!oldAccessToken) {
        return reply.code(401).send({ error: 'no_token' });
      }

      // Decode (don't validate - it's expired)
      const payload = tokenService.decodeToken(oldAccessToken);
      const userId = payload.sub;

      // Get stored refresh token
      const refreshToken = await tokenService.getRefreshToken(userId);
      if (!refreshToken) {
        return reply.code(401).send({ error: 'no_refresh_token' });
      }

      // Exchange refresh token for new tokens
      const newTokens = await oauthService.refreshAccessToken(refreshToken);

      // Rotate refresh token
      await tokenService.storeRefreshToken(userId, newTokens.refresh_token);

      // Set new access token cookie
      reply.setCookie('access_token', newTokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: newTokens.expires_in,
        path: '/',
      });

      return reply.send({ success: true });
    } catch (error: any) {
      req.log.error({ error }, 'Token refresh failed');
      return reply.code(401).send({ error: 'refresh_failed' });
    }
  }

  /**
   * POST /api/auth/logout
   * Clear session and revoke tokens
   */
  async logout(req: FastifyRequest, reply: FastifyReply) {
    try {
      const token = req.cookies.access_token;
      if (token) {
        const payload = tokenService.decodeToken(token);
        await tokenService.revokeRefreshToken(payload.sub);
      }

      reply.clearCookie('access_token', { path: '/' });
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(500).send({ error: 'logout_failed' });
    }
  }
}

export const authController = new AuthController();
```

#### 2. oauthService.ts
```typescript
import fetch from 'node-fetch';

interface ExchangeCodeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class OAuthService {
  private tokenUrl = `${process.env.EXTERNAL_AUTH_URL}/oauth/token`;
  private clientId = process.env.OAUTH_CLIENT_ID!;
  private clientSecret = process.env.OAUTH_CLIENT_SECRET!;

  async exchangeAuthorizationCode(params: ExchangeCodeParams): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code_verifier: params.codeVerifier,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    return response.json() as Promise<TokenResponse>;
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    return response.json() as Promise<TokenResponse>;
  }
}

export const oauthService = new OAuthService();
```

#### 3. userVerificationService.ts
```typescript
import fetch from 'node-fetch';
import { prisma } from '../../../lib/prisma';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

interface Subscription {
  tier: 'free' | 'basic' | 'professional' | 'enterprise';
  ecards_enabled: boolean;
  valid_until: string;
}

interface RateLimits {
  cards_per_month: number;
  current_usage: number;
  llm_credits: number;
  reset_date: string;
}

export class UserVerificationService {
  private userApiUrl = process.env.EXTERNAL_USER_API!;

  async fetchUserProfile(userId: string): Promise<UserProfile> {
    const response = await fetch(`${this.userApiUrl}/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.EXTERNAL_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    return response.json() as Promise<UserProfile>;
  }

  async fetchSubscription(userId: string): Promise<Subscription> {
    const response = await fetch(`${this.userApiUrl}/users/${userId}/subscription`, {
      headers: {
        'Authorization': `Bearer ${process.env.EXTERNAL_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription');
    }

    return response.json() as Promise<Subscription>;
  }

  async fetchRateLimits(userId: string): Promise<RateLimits> {
    const response = await fetch(`${this.userApiUrl}/users/${userId}/limits`, {
      headers: {
        'Authorization': `Bearer ${process.env.EXTERNAL_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch rate limits');
    }

    return response.json() as Promise<RateLimits>;
  }

  async syncUser(data: {
    externalId: string;
    email: string;
    name: string;
    subscription: string;
    rateLimits: RateLimits;
  }) {
    return prisma.user.upsert({
      where: { externalId: data.externalId },
      update: {
        email: data.email,
        name: data.name,
        subscriptionTier: data.subscription,
        rateLimit: {
          cardsPerMonth: data.rateLimits.cards_per_month,
          currentUsage: data.rateLimits.current_usage,
          llmCredits: data.rateLimits.llm_credits,
          resetDate: new Date(data.rateLimits.reset_date),
        },
        updatedAt: new Date(),
      },
      create: {
        externalId: data.externalId,
        email: data.email,
        name: data.name,
        subscriptionTier: data.subscription,
        rateLimit: {
          cardsPerMonth: data.rateLimits.cards_per_month,
          currentUsage: data.rateLimits.current_usage,
          llmCredits: data.rateLimits.llm_credits,
          resetDate: new Date(data.rateLimits.reset_date),
        },
      },
    });
  }

  async getUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
}

export const userVerificationService = new UserVerificationService();
```

#### 4. tokenService.ts
```typescript
import jwt from 'jsonwebtoken';
import { prisma } from '../../../lib/prisma';
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
const ALGORITHM = 'aes-256-gcm';

export class TokenService {
  /**
   * Validate JWT access token
   */
  async validateAccessToken(token: string): Promise<any> {
    // Fetch public key from remote auth server (or use cached)
    const publicKey = await this.getPublicKey();

    return new Promise((resolve, reject) => {
      jwt.verify(token, publicKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
  }

  /**
   * Decode token without validation (for expired tokens)
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Store refresh token encrypted in database
   */
  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const encrypted = this.encrypt(refreshToken);

    await prisma.userSession.upsert({
      where: { userId },
      update: {
        refreshToken: encrypted,
        updatedAt: new Date(),
      },
      create: {
        userId,
        refreshToken: encrypted,
      },
    });
  }

  /**
   * Get refresh token for user
   */
  async getRefreshToken(userId: string): Promise<string | null> {
    const session = await prisma.userSession.findUnique({ where: { userId } });
    if (!session?.refreshToken) return null;

    return this.decrypt(session.refreshToken);
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(userId: string): Promise<void> {
    await prisma.userSession.delete({ where: { userId } });
  }

  /**
   * Fetch OAuth provider's public key for JWT validation
   */
  private async getPublicKey(): Promise<string> {
    // TODO: Implement caching
    const response = await fetch(`${process.env.EXTERNAL_AUTH_URL}/.well-known/jwks.json`);
    const jwks = await response.json();
    // Convert JWK to PEM (use jose or node-jwk-to-pem library)
    return jwks.keys[0]; // Simplified
  }

  /**
   * Encrypt refresh token
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt refresh token
   */
  private decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export const tokenService = new TokenService();
```

#### 5. authMiddleware.ts
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { tokenService } from '../services/tokenService';

/**
 * Middleware to protect routes - validates access token
 */
export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      return reply.code(401).send({
        error: 'no_token',
        message: 'Authentication required',
      });
    }

    // Validate token
    const payload = await tokenService.validateAccessToken(token);

    // Attach user to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return reply.code(401).send({
        error: 'token_expired',
        message: 'Token expired - please refresh',
      });
    }

    return reply.code(401).send({
      error: 'invalid_token',
      message: 'Invalid authentication token',
    });
  }
}

/**
 * Optional middleware - allows both authenticated and anonymous users
 */
export async function optionalAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
  try {
    const token = req.cookies.access_token;
    if (token) {
      const payload = await tokenService.validateAccessToken(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
      };
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }
}
```

---

## API Endpoints

### 1. POST /api/auth/exchange-code

**Description:** Exchange authorization code for tokens (PKCE flow)

**Request:**
```json
{
  "code": "AUTHORIZATION_CODE_FROM_OAUTH",
  "codeVerifier": "RANDOM_CODE_VERIFIER",
  "redirectUri": "http://localhost:7300/auth/callback"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "subscription": "professional"
  }
}
```

**Errors:**
- `401 Unauthorized` - Invalid code or verifier
- `403 Forbidden` - Subscription doesn't allow E-Cards access
- `500 Internal Server Error` - Server error

---

### 2. GET /api/auth/me

**Description:** Get current authenticated user

**Headers:**
```
Cookie: access_token=JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "subscription": "professional",
    "rateLimit": {
      "cardsPerMonth": 10000,
      "currentUsage": 2500,
      "llmCredits": 500,
      "resetDate": "2025-12-01T00:00:00Z"
    }
  }
}
```

**Errors:**
- `401 Unauthorized` - Not authenticated or token expired

---

### 3. POST /api/auth/refresh

**Description:** Refresh access token using refresh token

**Headers:**
```
Cookie: access_token=EXPIRED_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Side Effect:** Sets new `access_token` cookie

**Errors:**
- `401 Unauthorized` - No refresh token or refresh failed

---

### 4. POST /api/auth/logout

**Description:** Logout user and revoke tokens

**Headers:**
```
Cookie: access_token=JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Side Effect:** Clears `access_token` cookie, revokes refresh token

---

## Database Schema

### User Table (PostgreSQL)
```prisma
model User {
  id                String   @id @default(uuid())
  externalId        String   @unique // ID from remote auth system
  email             String   @unique
  name              String
  organizationId    String?

  subscriptionTier  String   // 'free', 'basic', 'professional', 'enterprise'

  rateLimit         Json     // { cardsPerMonth, currentUsage, llmCredits, resetDate }

  sessions          UserSession[]
  templates         Template[]
  batches           Batch[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([externalId])
  @@index([email])
}
```

### UserSession Table (PostgreSQL)
```prisma
model UserSession {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  refreshToken  String   // Encrypted refresh token

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId])
}
```

### AuthAuditLog (Cassandra)
```cql
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID,
  user_id TEXT,
  event_type TEXT,  -- 'login', 'logout', 'refresh', 'access_denied'
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN,
  error_message TEXT,
  metadata MAP<TEXT, TEXT>,
  timestamp TIMESTAMP,
  PRIMARY KEY (user_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC);
```

---

## Frontend Components

### Route Structure

```
/                           # Landing page (public)
/auth/callback              # OAuth callback handler (public)
/dashboard                  # User dashboard (protected)
/templates                  # Template list (protected)
/batches                    # Batch list (protected)
```

### Protected Route Example

```tsx
// app/dashboard/page.tsx
'use client';
import { AuthGuard } from '@.claude/features/auto-auth/components/AuthGuard';
import { Dashboard } from '@/features/dashboard/components/Dashboard';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
```

```tsx
// AuthGuard.tsx
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

---

## Configuration

### Environment Variables (.env.dev.example)

```bash
# ============================================================================
# AUTO-AUTH CONFIGURATION
# ============================================================================

# OAuth 2.0 Client Credentials (from User App registration)
OAUTH_CLIENT_ID=ecards_app
OAUTH_CLIENT_SECRET=your_client_secret_here

# Remote System URLs
# User App - OAuth 2.0 Server
EXTERNAL_AUTH_URL=http://epicdev.com/app

# Admin API - Backend services
EXTERNAL_USER_API=http://epicdev.com/admin/api
EXTERNAL_SUBSCRIPTION_WS=ws://epicdev.com/admin/ws

# External API Authentication (for backend-to-backend calls)
EXTERNAL_API_KEY=your_api_key_for_backend_calls

# Token Encryption (for storing refresh tokens)
# Generate with: openssl rand -hex 32
TOKEN_ENCRYPTION_KEY=64_character_hex_string_here

# JWT Configuration (internal E-Cards tokens, if needed)
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRY=7d

# OAuth Scopes
OAUTH_SCOPES=profile email subscription

# Session Configuration
SESSION_COOKIE_NAME=access_token
SESSION_COOKIE_MAX_AGE=3600
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_HTTP_ONLY=true
SESSION_COOKIE_SAME_SITE=strict

# PKCE Configuration
PKCE_CODE_CHALLENGE_METHOD=S256

# Rate Limiting (Auth Endpoints)
AUTH_RATE_LIMIT_LOGIN_WINDOW=900000
AUTH_RATE_LIMIT_LOGIN_MAX=5
AUTH_RATE_LIMIT_CALLBACK_WINDOW=900000
AUTH_RATE_LIMIT_CALLBACK_MAX=10
AUTH_RATE_LIMIT_REFRESH_WINDOW=3600000
AUTH_RATE_LIMIT_REFRESH_MAX=20
```

### Frontend Environment Variables (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:7400
NEXT_PUBLIC_WS_URL=ws://localhost:7400
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app
NEXT_PUBLIC_EXTERNAL_AUTH_URL=http://epicdev.com
```

---

## Testing Strategy

### Unit Tests

**Frontend:**
- `useOAuthFlow.test.ts` - PKCE generation and OAuth URL building
- `authService.test.ts` - API client methods
- `crypto.test.ts` - Code verifier/challenge generation

**Backend:**
- `oauthService.test.ts` - Token exchange logic
- `tokenService.test.ts` - JWT validation and encryption
- `userVerificationService.test.ts` - Remote API calls (mocked)

### Integration Tests

**Flow Tests:**
- Complete OAuth flow from initiation to callback
- Token refresh flow
- Logout flow
- Subscription validation
- Rate limit enforcement

**API Tests:**
- POST /api/auth/exchange-code with valid/invalid codes
- GET /api/auth/me with valid/expired tokens
- POST /api/auth/refresh with valid/revoked tokens
- POST /api/auth/logout

### End-to-End Tests (Playwright)

```typescript
test('User can sign in via auto-auth', async ({ page }) => {
  // 1. Navigate to landing page
  await page.goto('http://localhost:7300');

  // 2. Click Sign In button
  await page.click('button:has-text("Sign In")');

  // 3. Should redirect to remote auth (mocked in test)
  await page.waitForURL(/epicdev.com\/oauth\/authorize/);

  // 4. Mock OAuth approval
  await page.goto('http://localhost:7300/auth/callback?code=TEST_CODE&state=TEST_STATE');

  // 5. Should redirect to dashboard
  await page.waitForURL('http://localhost:7300/dashboard');

  // 6. Should display user info
  await expect(page.locator('text=Welcome')).toBeVisible();
});
```

### Security Tests

- CSRF attack simulation (invalid state)
- Token tampering (modified JWT)
- Replay attack (reused authorization code)
- XSS injection in user data
- SQL injection in user inputs

---

## Error Handling

### Error Types

#### 1. OAuth Errors
```typescript
{
  error: 'invalid_grant',
  error_description: 'Authorization code expired'
}
```

**User-Facing Message:**
> "Your login session expired. Please try signing in again."

---

#### 2. Subscription Errors
```typescript
{
  error: 'subscription_required',
  message: 'Your subscription does not include E-Cards access'
}
```

**User-Facing Message:**
> "E-Cards requires a paid subscription. [Upgrade Now]"

---

#### 3. Rate Limit Errors
```typescript
{
  error: 'rate_limit_exceeded',
  limit: 100,
  current: 100,
  reset_date: '2025-12-01T00:00:00Z'
}
```

**User-Facing Message:**
> "You've reached your monthly limit of 100 cards. Resets on December 1st. [Upgrade Plan]"

---

#### 4. Network Errors
```typescript
{
  error: 'service_unavailable',
  message: 'Unable to connect to authentication service'
}
```

**User-Facing Message:**
> "We're having trouble connecting. Please try again in a few minutes."

---

### Error Recovery

**Automatic Retry:**
- Network errors: 3 retries with exponential backoff
- Token refresh: Automatic on 401 errors

**User Action Required:**
- Subscription errors: Redirect to subscription page
- Rate limit: Show upgrade options
- Invalid credentials: Redirect to remote login

---

## Performance Considerations

### Caching Strategy

**JWT Public Key:** Cache for 1 hour (reduces remote calls)
**User Profile:** Cache for 5 minutes (balance freshness vs performance)
**Subscription Status:** Real-time via WebSocket (no cache)

### Connection Pooling

**PostgreSQL:** Max 10 connections per api-server instance
**Cassandra:** Max 5 connections per node
**Redis:** Max 20 connections

### Response Times

**Target Latencies:**
- OAuth callback processing: <500ms
- /api/auth/me: <100ms
- Token refresh: <200ms
- User verification (remote API): <300ms

---

## Notes

### Design Decisions

1. **OAuth 2.0 + PKCE instead of simple redirects:**
   - Industry standard, well-tested
   - PKCE protects against code interception (mobile apps, SPA)
   - Supports token refresh without re-authentication

2. **HttpOnly cookies for access tokens:**
   - Prevents XSS attacks (JavaScript cannot access)
   - Automatic inclusion in API requests
   - Alternative: Authorization header (less secure for SPAs)

3. **Encrypted refresh tokens in database:**
   - If database compromised, tokens still protected
   - Rotation on each use prevents reuse attacks

4. **State parameter for CSRF:**
   - Prevents malicious authorization code injection
   - Must match value stored before redirect

5. **Subscription validation on every auth:**
   - Ensures users can't bypass subscription limits
   - Real-time enforcement (WebSocket updates subscription changes)

### Future Enhancements

- [ ] Social login (Google, Microsoft) as alternative
- [ ] WebAuthn/passkey support
- [ ] Device fingerprinting for fraud detection
- [ ] Geo-blocking based on subscription
- [ ] 2FA/MFA integration
- [ ] Session management dashboard (view active devices)

---

## Related Documentation

- [CONTEXT.md](../CONTEXT.md) - Full project context
- [SESSION_STARTERS.md](../.claude/SESSION_STARTERS.md) - Session templates
- **[auto-auth.external.md](./auto-auth.external.md)** - **REQUIRED READING** - External systems specifications
  - User App (epicdev.com/app) - OAuth 2.0 Server requirements
  - Admin API (epicdev.com/admin) - Backend API specifications
  - Complete endpoint documentation with request/response schemas
  - Test credentials and integration checklist

---

## External System Integration

**IMPORTANT:** This feature requires integration with TWO remote applications:

1. **User App** (`http://epicdev.com/app`)
   - Hosts OAuth 2.0 authorization server
   - Provides user authentication and consent screens
   - Issues JWT access tokens and refresh tokens
   - Endpoints: `/oauth/authorize`, `/oauth/token`, `/.well-known/jwks.json`

2. **Admin API** (`http://epicdev.com/admin`)
   - Provides user profile, subscription, and rate limit data
   - Handles backend-to-backend API calls (requires API key)
   - Sends real-time updates via WebSocket
   - Endpoints: `/api/users/:id`, `/api/users/:id/subscription`, `/api/users/:id/limits`, `/ws`

**For complete external system specifications, see [auto-auth.external.md](./auto-auth.external.md)**

This document includes:
- Detailed API endpoint specifications
- Request/response schemas for all endpoints
- OAuth 2.0 flow implementation details
- Security requirements (PKCE, API keys, rate limiting)
- WebSocket message formats
- Test credentials and integration testing checklist

---

Last Updated: 2025-11-15
