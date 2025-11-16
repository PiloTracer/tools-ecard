# OAuth 2.0 Implementation Guide for Remote Applications

## Overview

This guide explains how to integrate your application with the Tools Dashboard OAuth 2.0 system. When you register an application in the App Library, you receive OAuth credentials that allow users to securely authenticate and authorize your application to access their data.

---

## Table of Contents

1. [Understanding OAuth Credentials](#understanding-oauth-credentials)
2. [Redirect URIs](#redirect-uris)
3. [Allowed Scopes](#allowed-scopes)
4. [OAuth Flow Implementation](#oauth-flow-implementation)
5. [Code Examples](#code-examples)
6. [Security Best Practices](#security-best-practices)

---

## Understanding OAuth Credentials

### Client ID
**Example:** `ecards_app_dev`

**What it is:**
- A **public** identifier for your application
- Safe to include in client-side code (JavaScript, mobile apps)
- Used to identify which application is requesting access

**Where to use it:**
- In the OAuth authorization URL when redirecting users to login
- In token exchange requests
- In API requests (along with access token)

**Security:** Not secret - it's okay if users see this value.

---

### Client Secret
**Example:** `o940zNXww4xYvklk8HcmQEZEIeL1Yd-j`

**What it is:**
- A **confidential** password for your application
- Proves your application's identity to the authorization server
- Must be kept secure on your backend server

**Where to use it:**
- **ONLY on your backend server** (never in client-side code!)
- When exchanging authorization code for access token
- When refreshing access tokens

**Security:**
- ⚠️ **NEVER** expose this in client-side JavaScript, mobile apps, or public repositories
- Store in environment variables or secure configuration
- Regenerate immediately if compromised

**When to Regenerate:**
- If the secret is accidentally exposed
- As part of regular security rotation (every 90 days)
- When team members with access leave
- ⚠️ Warning: Regenerating invalidates all existing tokens using the old secret

---

## Redirect URIs

**Example:**
```
http://localhost:7300/auth/callback
http://localhost:7300/oauth/callback
```

### What are Redirect URIs?

Redirect URIs are URLs in **your application** where users will be sent back after they authorize (or deny) access on the Tools Dashboard login page.

### How They Work

1. **User clicks "Login with Tools Dashboard"** in your app
2. Your app redirects them to Tools Dashboard OAuth authorize URL
3. **User logs in and approves** the requested permissions
4. Tools Dashboard **redirects back** to one of your registered redirect URIs with an authorization code
5. Your backend exchanges the code for an access token

### Setting Up Redirect URIs

**In your application:**

```javascript
// Example: React/Next.js application
const OAUTH_CONFIG = {
  clientId: 'ecards_app_dev',
  redirectUri: 'http://localhost:7300/oauth/callback', // Must match exactly!
  authorizationEndpoint: 'https://epicdev.com/oauth/authorize',
};

// When user clicks login button:
function handleLogin() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: 'profile email subscription',
    state: generateRandomState(), // CSRF protection
  });

  window.location.href = `${OAUTH_CONFIG.authorizationEndpoint}?${params}`;
}
```

### Creating the Callback Route

**Frontend Route** (e.g., `/oauth/callback`):

```javascript
// pages/oauth/callback.tsx (Next.js example)
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleCallback() {
      const { code, state, error } = router.query;

      if (error) {
        console.error('OAuth error:', error);
        router.push('/login?error=oauth_failed');
        return;
      }

      if (!code) {
        router.push('/login?error=no_code');
        return;
      }

      // Verify state for CSRF protection
      const savedState = sessionStorage.getItem('oauth_state');
      if (state !== savedState) {
        console.error('State mismatch - possible CSRF attack');
        router.push('/login?error=invalid_state');
        return;
      }

      // Send code to your backend to exchange for access token
      try {
        const response = await fetch('/api/auth/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (data.success) {
          // Store access token securely (httpOnly cookie recommended)
          router.push('/dashboard');
        } else {
          router.push('/login?error=token_exchange_failed');
        }
      } catch (err) {
        console.error('Token exchange error:', err);
        router.push('/login?error=network_error');
      }
    }

    if (router.isReady) {
      handleCallback();
    }
  }, [router]);

  return <div>Processing login...</div>;
}
```

**Backend Token Exchange** (e.g., `/api/auth/exchange-token`):

```javascript
// pages/api/auth/exchange-token.ts (Next.js API route)
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://epicdev.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET, // ⚠️ Server-side only!
        redirect_uri: process.env.OAUTH_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('Token exchange failed:', error);
      return res.status(400).json({ success: false, error: 'Token exchange failed' });
    }

    const tokens = await tokenResponse.json();
    // tokens = { access_token, refresh_token, expires_in, token_type }

    // Store tokens securely (httpOnly cookie recommended)
    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${tokens.expires_in}`,
      `refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`, // 30 days
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
```

### Important Notes

✅ **Must match exactly** - The redirect URI in your authorization request must exactly match one registered in the App Library (including protocol, port, path)

❌ **Common mistakes:**
- `http://localhost:7300/callback` ≠ `http://localhost:7300/callback/` (trailing slash)
- `http://localhost:7300` ≠ `http://127.0.0.1:7300` (different host)
- `http://localhost:7300` ≠ `https://localhost:7300` (different protocol)

**Security:** Only add redirect URIs you control. Never add untrusted domains.

---

## Allowed Scopes

**Example:** `profile`, `email`, `subscription`

### What are Scopes?

Scopes define **what data and actions** your application can access on behalf of the user. They implement the principle of least privilege - request only what you need.

### Common Scopes

| Scope | Description | Data Access |
|-------|-------------|-------------|
| `profile` | Basic user profile information | User ID, display name, username |
| `email` | User's email address | Email address, email verification status |
| `subscription` | Subscription tier information | Current plan, billing status, limits |
| `cards:read` | Read user's cards (if E-Cards app) | View cards, templates |
| `cards:write` | Create/edit cards | Create, update, delete cards |
| `admin` | Administrative access | Full access (use sparingly!) |

### Requesting Scopes

**In authorization URL:**

```javascript
const scopes = ['profile', 'email', 'subscription'];

const authUrl = `https://epicdev.com/oauth/authorize?` +
  `response_type=code&` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `scope=${scopes.join(' ')}&` + // Space-separated
  `state=${state}`;

window.location.href = authUrl;
```

### Using Access Token with Scopes

Once you have an access token, you can access data based on the granted scopes:

```javascript
// Example: Fetch user profile
async function getUserProfile(accessToken) {
  const response = await fetch('https://epicdev.com/api/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const user = await response.json();
  // Returns: { id, username, email, display_name, ... }
  // (based on granted scopes)

  return user;
}
```

### Best Practices

✅ **Request minimum scopes** - Only ask for what you need
✅ **Explain to users** - Show why you need each permission
✅ **Incremental authorization** - Request additional scopes later if needed

❌ **Don't request `admin`** unless absolutely necessary
❌ **Don't request all scopes** just in case

---

## OAuth Flow Implementation

### Complete Authorization Code Flow (Recommended)

This is the most secure OAuth flow for web applications with a backend.

```
┌─────────────┐                                  ┌──────────────────┐
│   User      │                                  │  Your App        │
│   Browser   │                                  │  (Frontend)      │
└──────┬──────┘                                  └────────┬─────────┘
       │                                                  │
       │  1. Click "Login with Tools Dashboard"          │
       │◄────────────────────────────────────────────────┤
       │                                                  │
       │  2. Redirect to authorize URL                   │
       ├─────────────────────────────────────────────────►
       │                                                  │
       │                                         ┌────────┴─────────┐
       │                                         │  Tools Dashboard │
       │  3. Login & Approve Scopes              │  OAuth Server    │
       ├────────────────────────────────────────►│                  │
       │                                         └────────┬─────────┘
       │                                                  │
       │  4. Redirect back with ?code=xxx&state=yyy      │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │  5. Send code to your backend                   │
       ├─────────────────────────────────────────────────►
       │                                         ┌────────┴─────────┐
       │                                         │  Your Backend    │
       │  6. Exchange code for token             │                  │
       │                                         └────────┬─────────┘
       │                                                  │
       │                                                  │  7. POST /oauth/token
       │                                                  │     with code + secret
       │                                                  ├────────────┐
       │                                                  │            │
       │                                                  │◄───────────┤
       │                                                  │  8. Returns access_token
       │                                                  │
       │  9. Set httpOnly cookie & redirect to app       │
       │◄─────────────────────────────────────────────────┤
       │                                                  │
       │  10. Use access token in API requests           │
       ├─────────────────────────────────────────────────►
       │                                                  │
```

### Step-by-Step Implementation

#### Step 1: Initial Configuration

```javascript
// config/oauth.js
export const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID, // From App Library
  clientSecret: process.env.OAUTH_CLIENT_SECRET, // KEEP SECRET!
  redirectUri: process.env.OAUTH_REDIRECT_URI,
  authorizationEndpoint: 'https://epicdev.com/oauth/authorize',
  tokenEndpoint: 'https://epicdev.com/oauth/token',
  userInfoEndpoint: 'https://epicdev.com/api/users/me',
  scopes: ['profile', 'email', 'subscription'],
};
```

#### Step 2: Initiate Login

```javascript
// utils/oauth.js
import crypto from 'crypto';

export function generateAuthorizationUrl() {
  // Generate random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  sessionStorage.setItem('oauth_state', state);

  // Optional: PKCE (Proof Key for Code Exchange) for extra security
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  sessionStorage.setItem('code_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes.join(' '),
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${OAUTH_CONFIG.authorizationEndpoint}?${params}`;
}

// In your login page:
function handleLogin() {
  window.location.href = generateAuthorizationUrl();
}
```

#### Step 3: Handle Callback (Frontend)

```javascript
// pages/oauth/callback.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function processCallback() {
      const { code, state, error } = router.query;

      // Check for errors
      if (error) {
        console.error('OAuth error:', error);
        return router.push(`/login?error=${error}`);
      }

      // Verify state (CSRF protection)
      const savedState = sessionStorage.getItem('oauth_state');
      if (state !== savedState) {
        console.error('Invalid state - possible CSRF attack');
        return router.push('/login?error=invalid_state');
      }

      // Exchange code for token via backend
      const codeVerifier = sessionStorage.getItem('code_verifier');

      const response = await fetch('/api/auth/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier }),
      });

      const result = await response.json();

      if (result.success) {
        // Clean up
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('code_verifier');

        // Redirect to app
        router.push('/dashboard');
      } else {
        router.push('/login?error=token_exchange_failed');
      }
    }

    if (router.isReady) {
      processCallback();
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing login...</p>
      </div>
    </div>
  );
}
```

#### Step 4: Exchange Code for Token (Backend)

```javascript
// pages/api/auth/exchange-token.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, codeVerifier } = req.body;

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://epicdev.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.OAUTH_REDIRECT_URI,
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        code_verifier: codeVerifier, // For PKCE
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('Token exchange failed:', error);
      return res.status(400).json({
        success: false,
        error: error.error_description || 'Token exchange failed'
      });
    }

    const tokens = await tokenResponse.json();
    /*
    tokens = {
      access_token: 'eyJhbGciOiJIUzI1NiIs...',
      refresh_token: 'def502003d4f5e...',
      token_type: 'Bearer',
      expires_in: 3600, // seconds
      scope: 'profile email subscription'
    }
    */

    // Fetch user info
    const userResponse = await fetch('https://epicdev.com/api/users/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    const user = await userResponse.json();

    // Store tokens in httpOnly cookies (secure!)
    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${tokens.expires_in}`,
      `refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
      `user_id=${user.id}; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
    ]);

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      }
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
```

#### Step 5: Use Access Token

```javascript
// utils/api.js
import { parseCookies } from 'nookies';

export async function apiRequest(url, options = {}) {
  const cookies = parseCookies();
  const accessToken = cookies.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`https://epicdev.com${url}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Token expired - try to refresh
    await refreshAccessToken();
    // Retry original request
    return apiRequest(url, options);
  }

  return response;
}

// Example usage:
async function getUserCards() {
  const response = await apiRequest('/api/cards/me');
  const cards = await response.json();
  return cards;
}
```

#### Step 6: Refresh Token Flow

```javascript
// pages/api/auth/refresh-token.ts
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const cookies = parseCookies({ req });
  const refreshToken = cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const tokenResponse = await fetch('https://epicdev.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      return res.status(401).json({ error: 'Refresh failed' });
    }

    const tokens = await tokenResponse.json();

    // Update cookies with new tokens
    res.setHeader('Set-Cookie', [
      `access_token=${tokens.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${tokens.expires_in}`,
      `refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## Code Examples

### Express.js (Node.js) Backend Example

```javascript
// server.js
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/oauth/callback',
  authorizationEndpoint: 'https://epicdev.com/oauth/authorize',
  tokenEndpoint: 'https://epicdev.com/oauth/token',
  scopes: ['profile', 'email'],
};

app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
}));

// Login route
app.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const authUrl = new URL(OAUTH_CONFIG.authorizationEndpoint);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', OAUTH_CONFIG.clientId);
  authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.redirectUri);
  authUrl.searchParams.append('scope', OAUTH_CONFIG.scopes.join(' '));
  authUrl.searchParams.append('state', state);

  res.redirect(authUrl.toString());
});

// Callback route
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state
  if (state !== req.session.oauthState) {
    return res.status(403).send('Invalid state parameter');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(OAUTH_CONFIG.tokenEndpoint, {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret,
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Store tokens in session
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Token exchange failed:', error);
    res.status(500).send('Authentication failed');
  }
});

// Protected route example
app.get('/api/user', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userResponse = await axios.get('https://epicdev.com/api/users/me', {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`,
      },
    });

    res.json(userResponse.data);
  } catch (error) {
    if (error.response?.status === 401) {
      // Try to refresh token
      // ... refresh logic here
    }
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Python (Flask) Backend Example

```python
# app.py
from flask import Flask, request, redirect, session, jsonify
import requests
import secrets
import os
from urllib.parse import urlencode

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')

OAUTH_CONFIG = {
    'client_id': os.environ['OAUTH_CLIENT_ID'],
    'client_secret': os.environ['OAUTH_CLIENT_SECRET'],
    'redirect_uri': 'http://localhost:5000/oauth/callback',
    'authorization_endpoint': 'https://epicdev.com/oauth/authorize',
    'token_endpoint': 'https://epicdev.com/oauth/token',
    'scopes': ['profile', 'email'],
}

@app.route('/login')
def login():
    state = secrets.token_hex(16)
    session['oauth_state'] = state

    params = {
        'response_type': 'code',
        'client_id': OAUTH_CONFIG['client_id'],
        'redirect_uri': OAUTH_CONFIG['redirect_uri'],
        'scope': ' '.join(OAUTH_CONFIG['scopes']),
        'state': state,
    }

    auth_url = f"{OAUTH_CONFIG['authorization_endpoint']}?{urlencode(params)}"
    return redirect(auth_url)

@app.route('/oauth/callback')
def oauth_callback():
    code = request.args.get('code')
    state = request.args.get('state')

    # Verify state
    if state != session.get('oauth_state'):
        return 'Invalid state parameter', 403

    # Exchange code for token
    token_response = requests.post(OAUTH_CONFIG['token_endpoint'], data={
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': OAUTH_CONFIG['redirect_uri'],
        'client_id': OAUTH_CONFIG['client_id'],
        'client_secret': OAUTH_CONFIG['client_secret'],
    })

    if not token_response.ok:
        return 'Token exchange failed', 500

    tokens = token_response.json()
    session['access_token'] = tokens['access_token']
    session['refresh_token'] = tokens['refresh_token']

    return redirect('/dashboard')

@app.route('/api/user')
def get_user():
    access_token = session.get('access_token')

    if not access_token:
        return jsonify({'error': 'Not authenticated'}), 401

    user_response = requests.get(
        'https://epicdev.com/api/users/me',
        headers={'Authorization': f'Bearer {access_token}'}
    )

    if user_response.ok:
        return jsonify(user_response.json())
    else:
        return jsonify({'error': 'Failed to fetch user'}), 500

if __name__ == '__main__':
    app.run(debug=True)
```

---

## Security Best Practices

### 🔒 Client Secret Security

✅ **DO:**
- Store in environment variables
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate regularly (every 90 days)
- Restrict access to production secrets

❌ **DON'T:**
- Commit to Git repositories
- Include in client-side code
- Share via email/chat
- Log in plain text

### 🔒 Token Storage

✅ **DO:**
- Use httpOnly cookies for web apps
- Use secure storage for mobile (Keychain/Keystore)
- Set appropriate expiration times
- Clear on logout

❌ **DON'T:**
- Store in localStorage/sessionStorage (XSS risk)
- Store in regular cookies without httpOnly
- Keep tokens indefinitely

### 🔒 State Parameter (CSRF Protection)

✅ **ALWAYS:**
- Generate random state value
- Store in session/storage before redirect
- Verify on callback
- Use cryptographically secure random generator

```javascript
// Good
const state = crypto.randomBytes(32).toString('hex');
sessionStorage.setItem('oauth_state', state);

// Bad
const state = Math.random().toString(); // Predictable!
```

### 🔒 PKCE (Proof Key for Code Exchange)

**Highly recommended** for mobile and single-page apps:

```javascript
import crypto from 'crypto';

// 1. Generate code verifier (random string)
const codeVerifier = crypto.randomBytes(32).toString('hex');

// 2. Create code challenge (SHA-256 hash)
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// 3. Send challenge in auth request
const authUrl = `${authEndpoint}?` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256&` +
  `...other params`;

// 4. Send verifier in token exchange
const tokenRequest = {
  code: authCode,
  code_verifier: codeVerifier,
  ...
};
```

### 🔒 Redirect URI Validation

✅ **DO:**
- Use exact match validation
- Use HTTPS in production
- Whitelist specific paths
- Validate before redirecting

❌ **DON'T:**
- Use wildcards or partial matches
- Allow user-controlled redirects
- Use HTTP in production

### 🔒 Scope Management

✅ **DO:**
- Request minimum required scopes
- Check granted scopes in token response
- Handle scope denial gracefully
- Document why each scope is needed

❌ **DON'T:**
- Request all available scopes
- Assume scopes were granted
- Force users to accept unnecessary scopes

---

## Testing Your Integration

### Test Checklist

- [ ] Login flow redirects correctly
- [ ] State parameter validation works
- [ ] Token exchange succeeds
- [ ] Access token works for API calls
- [ ] Refresh token flow works
- [ ] Logout clears all tokens
- [ ] Error handling for:
  - [ ] User denies access
  - [ ] Invalid credentials
  - [ ] Expired tokens
  - [ ] Network errors

### Using cURL for Testing

**1. Test authorization (copy URL to browser):**
```bash
echo "https://epicdev.com/oauth/authorize?response_type=code&client_id=ecards_app_dev&redirect_uri=http://localhost:7300/oauth/callback&scope=profile%20email&state=random123"
```

**2. Exchange code for token:**
```bash
curl -X POST https://epicdev.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTH_CODE_HERE",
    "client_id": "ecards_app_dev",
    "client_secret": "o940zNXww4xYvklk8HcmQEZEIeL1Yd-j",
    "redirect_uri": "http://localhost:7300/oauth/callback"
  }'
```

**3. Use access token:**
```bash
curl https://epicdev.com/api/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**4. Refresh token:**
```bash
curl -X POST https://epicdev.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "YOUR_REFRESH_TOKEN",
    "client_id": "ecards_app_dev",
    "client_secret": "o940zNXww4xYvklk8HcmQEZEIeL1Yd-j"
  }'
```

---

## Common Issues & Troubleshooting

### Issue: "Redirect URI mismatch"
**Cause:** The redirect_uri in your request doesn't exactly match a registered URI
**Solution:** Check for trailing slashes, protocol (http vs https), port numbers

### Issue: "Invalid client credentials"
**Cause:** Wrong client_id or client_secret
**Solution:** Verify credentials, regenerate secret if needed

### Issue: "Invalid authorization code"
**Cause:** Code already used, expired, or invalid
**Solution:** Authorization codes are single-use and expire in 10 minutes

### Issue: "Access token expired"
**Cause:** Tokens typically expire after 1 hour
**Solution:** Implement refresh token flow

### Issue: "Insufficient scope"
**Cause:** Trying to access data not covered by granted scopes
**Solution:** Request additional scopes or check granted scopes

---

## Additional Resources

- **OAuth 2.0 RFC:** https://datatracker.ietf.org/doc/html/rfc6749
- **OAuth 2.0 Playground:** https://www.oauth.com/playground/
- **JWT Decoder:** https://jwt.io
- **PKCE Guide:** https://oauth.net/2/pkce/

---

## Support

If you need help implementing OAuth in your application:
1. Check this guide first
2. Review the error messages carefully
3. Test with cURL to isolate issues
4. Contact Tools Dashboard support with:
   - Your client_id
   - Error messages
   - Request/response logs (redact secrets!)
