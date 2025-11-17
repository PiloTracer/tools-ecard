# Auto-Auth Feature - External Systems Specification

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Purpose:** Define technical requirements for remote applications to support E-Cards auto-auth

---

## Table of Contents

1. [Overview](#overview)
2. [Remote Applications](#remote-applications)
3. [Authentication Flow](#authentication-flow)
4. [OAuth 2.0 Server Requirements](#oauth-20-server-requirements)
5. [Admin API Requirements](#admin-api-requirements)
6. [User App Requirements](#user-app-requirements)
7. [Data Models](#data-models)
8. [Security Requirements](#security-requirements)
9. [WebSocket Subscriptions](#websocket-subscriptions)
10. [Error Responses](#error-responses)
11. [Testing & Integration](#testing--integration)

---

## Overview

The E-Cards auto-auth feature requires integration with **two remote applications**:

1. **User Application** (`http://epicdev.com/app`)
   - User-facing application where users are already authenticated
   - Initiates E-Cards access via button/link
   - Hosts OAuth 2.0 authorization server

2. **Admin API** (`http://epicdev.com/admin`)
   - Backend API for administrative operations
   - Provides user verification, subscription data, rate limits
   - Handles backend-to-backend authentication

### Communication Pattern

```
┌─────────────────────────────────────────────────────────────┐
│         E-Cards Application (localhost:7300)                │
│                                                             │
│  Frontend:                                                  │
│  - Receives OAuth redirect from epicdev.com/app            │
│  - Handles callback with authorization code                │
│                                                             │
│  Backend:                                                   │
│  - Exchanges code for tokens (→ epicdev.com/app/oauth)     │
│  - Fetches user data (→ epicdev.com/admin/api)             │
│  - Validates subscription (→ epicdev.com/admin/api)        │
│  - Checks rate limits (→ epicdev.com/admin/api)            │
└─────────────────────────────────────────────────────────────┘
                           ▲         │
                           │         │
        OAuth redirect     │         │ API calls (with API key)
        (user browser)     │         │ (backend-to-backend)
                           │         ▼
┌──────────────────────────┴──────────────────────────────────┐
│              Remote Applications (epicdev.com)              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  User App (epicdev.com/app)                         │   │
│  │  - User dashboard with "E-Cards" button             │   │
│  │  - OAuth 2.0 Authorization Server                   │   │
│  │    • /oauth/authorize (user consent)                │   │
│  │    • /oauth/token (token exchange)                  │   │
│  │    • /.well-known/jwks.json (public keys)           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Admin API (epicdev.com/admin)                      │   │
│  │  - Backend API for E-Cards integration              │   │
│  │    • GET /api/users/:userId (profile)               │   │
│  │    • GET /api/users/:userId/subscription            │   │
│  │    • GET /api/users/:userId/limits                  │   │
│  │    • POST /api/users/:userId/verify                 │   │
│  │    • WebSocket: /ws (real-time updates)             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Remote Applications

### 1. User Application (epicdev.com/app)

**Purpose:** User-facing application where users perform daily tasks

**Responsibilities:**
- Display "E-Cards" button/link in user dashboard
- Host OAuth 2.0 authorization server for E-Cards integration
- Handle user authentication and session management
- Show OAuth consent screen (first-time only)
- Redirect to E-Cards with authorization code

**URL Structure:**
```
Base URL: http://epicdev.com/app (or http://epicdev.com/app in production)

User-facing:
  /                          # User dashboard
  /oauth/authorize           # OAuth authorization endpoint (user consent)

API endpoints:
  /oauth/token               # Token exchange endpoint
  /oauth/revoke              # Token revocation
  /.well-known/jwks.json     # Public keys for JWT validation
  /.well-known/openid-configuration  # OAuth discovery document
```

### 2. Admin API (epicdev.com/admin)

**Purpose:** Backend API for administrative and integration operations

**Responsibilities:**
- Provide user profile data to E-Cards
- Provide subscription information (tier, features, expiry)
- Provide rate limits and current usage
- Verify user identity and permissions
- Real-time subscription updates via WebSocket

**URL Structure:**
```
Base URL: http://epicdev.com/admin (or http://epicdev.com/admin in production)

API endpoints:
  /api/users/:userId                    # User profile
  /api/users/:userId/subscription       # Subscription details
  /api/users/:userId/limits             # Rate limits
  /api/users/:userId/verify             # Verify user identity
  /api/users/:userId/usage              # Usage statistics
  /api/organizations/:orgId             # Organization details

WebSocket:
  /ws                                   # Real-time updates
```

---

## Authentication Flow

### Step-by-Step Integration

#### 1. User Initiates E-Cards Access (User App)

**Location:** `http://epicdev.com/app` (User Dashboard)

**Implementation:**
```html
<!-- User App Dashboard -->
<div class="app-shortcuts">
  <a href="#"
     onclick="openECards()"
     class="app-button">
    <icon>📇</icon>
    <span>E-Cards</span>
  </a>
</div>

<script>
function openECards() {
  // Open E-Cards in new tab
  window.open('http://localhost:7300/', '_blank');

  // Optional: Track usage analytics
  trackEvent('ecards_accessed');
}
</script>
```

**Expected Behavior:**
- User clicks "E-Cards" button
- New browser tab opens to `http://localhost:7300/`
- User remains authenticated in original tab
- E-Cards landing page displays

#### 2. E-Cards Initiates OAuth Flow (E-Cards Frontend)

**Location:** `http://localhost:7300/` → User clicks "Sign In"

**Request to User App:**
```
GET http://epicdev.com/app/oauth/authorize?
  client_id=ecards_app
  &redirect_uri=http://localhost:7300/auth/callback
  &response_type=code
  &scope=profile+email+subscription
  &state=RANDOM_CSRF_TOKEN
  &code_challenge=BASE64_SHA256_HASH
  &code_challenge_method=S256
```

**User App Response:**
- If user NOT authenticated: Redirect to login page
- If user authenticated + NOT consented: Show consent screen
- If user authenticated + consented: Redirect to E-Cards with code

#### 3. OAuth Consent Screen (User App)

**Location:** `http://epicdev.com/app/oauth/authorize` (if consent needed)

**UI Requirements:**
```html
<div class="oauth-consent">
  <h2>E-Cards wants to access your account</h2>

  <div class="app-info">
    <img src="/ecards-logo.png" alt="E-Cards">
    <p>E-Cards System by Code Digital Group</p>
  </div>

  <div class="permissions">
    <h3>This will allow E-Cards to:</h3>
    <ul>
      <li>✓ Read your profile information (name, email)</li>
      <li>✓ Check your subscription status</li>
      <li>✓ Access usage limits based on your plan</li>
    </ul>
  </div>

  <div class="actions">
    <button onclick="approve()">Allow</button>
    <button onclick="deny()">Deny</button>
  </div>
</div>
```

**On Approval:**
```javascript
// User App - Approval Handler
function approve() {
  // Generate authorization code (short-lived, 10 minutes)
  const authCode = generateAuthorizationCode({
    userId: currentUser.id,
    clientId: 'ecards_app',
    scope: 'profile email subscription',
    codeChallenge: request.query.code_challenge,
    codeChallengeMethod: 'S256',
    expiresAt: Date.now() + 600000 // 10 minutes
  });

  // Store code temporarily (Redis or database)
  await storeAuthCode(authCode);

  // Redirect back to E-Cards
  const redirectUrl = `${request.query.redirect_uri}?code=${authCode}&state=${request.query.state}`;
  window.location.href = redirectUrl;
}
```

**On Denial:**
```javascript
function deny() {
  const redirectUrl = `${request.query.redirect_uri}?error=access_denied&state=${request.query.state}`;
  window.location.href = redirectUrl;
}
```

#### 4. Token Exchange (User App OAuth Server)

**Endpoint:** `POST http://epicdev.com/app/oauth/token`

**E-Cards Request:**
```http
POST /oauth/token HTTP/1.1
Host: epicdev.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTH_CODE_FROM_REDIRECT
&redirect_uri=http://localhost:7300/auth/callback
&client_id=ecards_app
&client_secret=ECARDS_CLIENT_SECRET
&code_verifier=ORIGINAL_PKCE_CODE_VERIFIER
```

**User App Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwibmFtZSI6IkpvaG4gRG9lIiwicm9sZXMiOlsidXNlciJdLCJpYXQiOjE2MzAwMDAwMDAsImV4cCI6MTYzMDAwMzYwMCwiaXNzIjoiaHR0cDovL2VwaWNkZXYuY29tIiwiYXVkIjoiZWNhcmRzX2FwcCJ9.signature",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE2MzAwMDAwMDAsImV4cCI6MTYzMjU5MjAwMH0.signature",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "profile email subscription"
}
```

**JWT Access Token Payload:**
```json
{
  "sub": "user123",              // User ID (required)
  "email": "john@example.com",   // Email (required)
  "name": "John Doe",            // Full name (required)
  "roles": ["user"],             // User roles (optional)
  "iat": 1630000000,             // Issued at timestamp
  "exp": 1630003600,             // Expiry timestamp (1 hour)
  "iss": "http://epicdev.com",   // Issuer (User App URL)
  "aud": "ecards_app"            // Audience (E-Cards client ID)
}
```

**Validation Requirements:**
- Verify `code` matches stored authorization code
- Verify `redirect_uri` matches original request
- Verify `client_id` and `client_secret` are valid
- Verify PKCE: `SHA256(code_verifier) === code_challenge`
- Mark authorization code as used (prevent reuse)
- Generate JWT signed with RS256 private key

#### 5. User Data Retrieval (Admin API)

**After token exchange, E-Cards backend calls Admin API**

---

## OAuth 2.0 Server Requirements

### Required Endpoints (User App)

#### 1. GET /oauth/authorize

**Purpose:** Authorization endpoint (user consent)

**Request Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | E-Cards client identifier (e.g., "ecards_app") |
| `redirect_uri` | Yes | E-Cards callback URL (must be pre-registered) |
| `response_type` | Yes | Must be "code" (authorization code flow) |
| `scope` | Yes | Space-separated scopes: "profile email subscription" |
| `state` | Yes | CSRF token from E-Cards |
| `code_challenge` | Yes | Base64URL(SHA256(code_verifier)) |
| `code_challenge_method` | Yes | Must be "S256" |

**Response (Success):**
```
HTTP/1.1 302 Found
Location: http://localhost:7300/auth/callback?code=AUTH_CODE&state=CSRF_TOKEN
```

**Response (User Denied):**
```
HTTP/1.1 302 Found
Location: http://localhost:7300/auth/callback?error=access_denied&state=CSRF_TOKEN
```

**Response (Error):**
```
HTTP/1.1 302 Found
Location: http://localhost:7300/auth/callback?error=invalid_request&error_description=Missing+client_id&state=CSRF_TOKEN
```

---

#### 2. POST /oauth/token

**Purpose:** Token exchange endpoint

**Request Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Request Body (Authorization Code Grant):**
```
grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=http://localhost:7300/auth/callback
&client_id=ecards_app
&client_secret=CLIENT_SECRET
&code_verifier=PKCE_CODE_VERIFIER
```

**Request Body (Refresh Token Grant):**
```
grant_type=refresh_token
&refresh_token=REFRESH_TOKEN
&client_id=ecards_app
&client_secret=CLIENT_SECRET
```

**Response (Success):**
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "profile email subscription"
}
```

**Response (Error):**
```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code expired or invalid"
}
```

**Error Codes:**
- `invalid_request` - Missing required parameter
- `invalid_client` - Invalid client_id or client_secret
- `invalid_grant` - Invalid/expired authorization code
- `unauthorized_client` - Client not authorized for this grant type
- `unsupported_grant_type` - Grant type not supported

---

#### 3. POST /oauth/revoke

**Purpose:** Revoke access or refresh token

**Request:**
```http
POST /oauth/revoke HTTP/1.1
Content-Type: application/x-www-form-urlencoded

token=ACCESS_OR_REFRESH_TOKEN
&token_type_hint=access_token
&client_id=ecards_app
&client_secret=CLIENT_SECRET
```

**Response:**
```http
HTTP/1.1 200 OK
```

---

#### 4. GET /.well-known/jwks.json

**Purpose:** Public keys for JWT signature verification

**Response:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "2024-11-15",
      "alg": "RS256",
      "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
      "e": "AQAB"
    }
  ]
}
```

**Key Requirements:**
- Algorithm: RS256 (RSA with SHA-256)
- Key rotation: Support multiple keys with `kid` (key ID)
- Public keys must be accessible without authentication

---

#### 5. GET /.well-known/openid-configuration (Optional)

**Purpose:** OAuth 2.0 discovery document

**Response:**
```json
{
  "issuer": "http://epicdev.com",
  "authorization_endpoint": "http://epicdev.com/app/oauth/authorize",
  "token_endpoint": "http://epicdev.com/app/oauth/token",
  "jwks_uri": "http://epicdev.com/app/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["client_secret_post"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["profile", "email", "subscription"]
}
```

---

## Admin API Requirements

### Authentication

**All Admin API requests require API key authentication:**

```http
GET /api/users/user123 HTTP/1.1
Host: epicdev.com
Authorization: Bearer ECARDS_API_KEY
Accept: application/json
```

**API Key Management:**
- Generate API key for E-Cards application in Admin panel
- Store securely in E-Cards environment variables (`EXTERNAL_API_KEY`)
- Rotate regularly (every 90 days recommended)

---

### Required Endpoints (Admin API)

#### 1. GET /api/users/:userId

**Purpose:** Fetch user profile information

**Request:**
```http
GET /api/users/user123 HTTP/1.1
Host: epicdev.com
Authorization: Bearer ECARDS_API_KEY
```

**Response (200 OK):**
```json
{
  "id": "user123",
  "email": "john.doe@example.com",
  "name": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "organizationId": "org456",
  "organizationName": "Acme Corporation",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-11-15T14:20:00Z",
  "metadata": {
    "department": "Marketing",
    "jobTitle": "Marketing Manager"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "user_not_found",
  "message": "User with ID 'user123' does not exist"
}
```

---

#### 2. GET /api/users/:userId/subscription

**Purpose:** Fetch user subscription details

**Request:**
```http
GET /api/users/user123/subscription HTTP/1.1
Host: epicdev.com
Authorization: Bearer ECARDS_API_KEY
```

**Response (200 OK):**
```json
{
  "userId": "user123",
  "tier": "professional",
  "plan": "Professional Plan",
  "status": "active",
  "features": {
    "ecards_enabled": true,
    "template_limit": 50,
    "batch_size_limit": 5000,
    "storage_gb": 10
  },
  "billingCycle": "monthly",
  "currentPeriodStart": "2024-11-01T00:00:00Z",
  "currentPeriodEnd": "2024-12-01T00:00:00Z",
  "validUntil": "2024-12-01T00:00:00Z",
  "autoRenew": true,
  "trialEndsAt": null
}
```

**Subscription Tiers:**
| Tier | E-Cards Enabled | Cards/Month | Templates | Batch Size |
|------|----------------|-------------|-----------|------------|
| `free` | false | 0 | 0 | 0 |
| `basic` | true | 100 | 5 | 500 |
| `professional` | true | 10,000 | 50 | 5,000 |
| `enterprise` | true | unlimited | unlimited | unlimited |

**Response (403 Forbidden):**
```json
{
  "error": "subscription_required",
  "message": "User does not have an active subscription"
}
```

---

#### 3. GET /api/users/:userId/limits

**Purpose:** Fetch current usage and rate limits

**Request:**
```http
GET /api/users/user123/limits HTTP/1.1
Host: epicdev.com
Authorization: Bearer ECARDS_API_KEY
```

**Response (200 OK):**
```json
{
  "userId": "user123",
  "subscriptionTier": "professional",
  "limits": {
    "cardsPerMonth": 10000,
    "currentUsage": 2547,
    "remainingCards": 7453,
    "llmCredits": 500,
    "llmCreditsUsed": 127,
    "storage": {
      "limitGB": 10,
      "usedGB": 3.2,
      "remainingGB": 6.8
    },
    "templates": {
      "limit": 50,
      "current": 12,
      "remaining": 38
    },
    "batches": {
      "activeLimit": 10,
      "currentActive": 3
    }
  },
  "resetDate": "2024-12-01T00:00:00Z",
  "billingCycle": "monthly"
}
```

**E-Cards Enforcement:**
- Check `currentUsage < cardsPerMonth` before allowing batch creation
- Allow READ operations even at limit
- Block CREATE operations when limit reached
- Show user upgrade prompts

---

#### 4. POST /api/users/:userId/verify

**Purpose:** Verify user identity and permissions

**Request:**
```http
POST /api/users/user123/verify HTTP/1.1
Host: epicdev.com
Authorization: Bearer ECARDS_API_KEY
Content-Type: application/json

{
  "application": "ecards",
  "requiredPermissions": ["ecards.read", "ecards.write"]
}
```

**Response (200 OK):**
```json
{
  "userId": "user123",
  "verified": true,
  "permissions": ["ecards.read", "ecards.write", "ecards.admin"],
  "hasAccess": true,
  "reason": null
}
```

**Response (403 Forbidden):**
```json
{
  "userId": "user123",
  "verified": true,
  "permissions": ["ecards.read"],
  "hasAccess": false,
  "reason": "Missing required permission: ecards.write"
}
```

---

#### 5. POST /api/users/:userId/usage

**Purpose:** Record usage event (optional - for billing)

**Request:**
```http
POST /api/users/user123/usage HTTP/1.1
Host: epicdev.com
Authorization: Bearer ECARDS_API_KEY
Content-Type: application/json

{
  "event": "cards_generated",
  "quantity": 250,
  "batchId": "batch789",
  "timestamp": "2024-11-15T14:30:00Z",
  "metadata": {
    "templateId": "template456",
    "totalCards": 250
  }
}
```

**Response (201 Created):**
```json
{
  "eventId": "event123",
  "recorded": true,
  "newUsage": 2797,
  "remainingCards": 7203
}
```

---

#### 6. GET /api/organizations/:orgId

**Purpose:** Fetch organization details (optional)

**Request:**
```http
GET /api/organizations/org456 HTTP/1.1
Host: epicdev.com
Authorization: Bearer ECARDS_API_KEY
```

**Response (200 OK):**
```json
{
  "id": "org456",
  "name": "Acme Corporation",
  "domain": "acme.com",
  "subscriptionTier": "enterprise",
  "userCount": 150,
  "adminUsers": ["user123", "user789"],
  "features": {
    "ecards_enabled": true,
    "shared_templates": true,
    "sso_enabled": true
  },
  "createdAt": "2020-05-10T08:00:00Z"
}
```

---

## Data Models

### User Object

```typescript
interface User {
  id: string;                      // Unique user identifier
  email: string;                   // User email (unique)
  name: string;                    // Full name
  firstName?: string;              // First name
  lastName?: string;               // Last name
  organizationId?: string;         // Organization ID (if applicable)
  organizationName?: string;       // Organization name
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;               // ISO 8601 timestamp
  updatedAt: string;               // ISO 8601 timestamp
  metadata?: Record<string, any>;  // Additional user data
}
```

### Subscription Object

```typescript
interface Subscription {
  userId: string;
  tier: 'free' | 'basic' | 'professional' | 'enterprise';
  plan: string;                    // Human-readable plan name
  status: 'active' | 'past_due' | 'canceled' | 'trial';
  features: {
    ecards_enabled: boolean;
    template_limit: number;
    batch_size_limit: number;
    storage_gb: number;
    [key: string]: any;
  };
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: string;      // ISO 8601
  currentPeriodEnd: string;        // ISO 8601
  validUntil: string;              // ISO 8601
  autoRenew: boolean;
  trialEndsAt?: string;            // ISO 8601 (if in trial)
}
```

### Rate Limits Object

```typescript
interface RateLimits {
  userId: string;
  subscriptionTier: string;
  limits: {
    cardsPerMonth: number;
    currentUsage: number;
    remainingCards: number;
    llmCredits: number;
    llmCreditsUsed: number;
    storage: {
      limitGB: number;
      usedGB: number;
      remainingGB: number;
    };
    templates: {
      limit: number;
      current: number;
      remaining: number;
    };
    batches: {
      activeLimit: number;
      currentActive: number;
    };
  };
  resetDate: string;               // ISO 8601
  billingCycle: 'monthly' | 'yearly';
}
```

---

## Security Requirements

### 1. OAuth 2.0 Security

**Client Registration:**
```json
{
  "client_id": "ecards_app",
  "client_secret": "SECURE_RANDOM_SECRET_256_BITS",
  "client_name": "E-Cards System",
  "redirect_uri": [
    "http://localhost:7300/auth/callback"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "client_secret_post",
  "scope": "profile email subscription"
}
```

**PKCE Validation:**
```javascript
// User App - Token Exchange Handler
async function validatePKCE(code, codeVerifier) {
  // Retrieve stored authorization code
  const storedCode = await getAuthCode(code);

  // Hash the verifier
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const computedChallenge = base64url(hash);

  // Compare with stored challenge
  if (computedChallenge !== storedCode.codeChallenge) {
    throw new Error('Invalid code_verifier');
  }

  return true;
}
```

**Token Security:**
- Access tokens: Short-lived (1 hour)
- Refresh tokens: Long-lived (30 days), rotated on use
- JWT signing: RS256 (RSA with SHA-256)
- Token storage: Never log tokens in plaintext
- Revocation: Support immediate token revocation

---

### 2. API Key Security

**Admin API Key Requirements:**
- Minimum length: 64 characters
- Format: `eak_` prefix + random alphanumeric
- Example: `eak_4f3b9a8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0`

**Key Rotation:**
```http
POST /admin/api-keys/rotate HTTP/1.1
Host: epicdev.com
Authorization: Bearer ADMIN_AUTH_TOKEN

{
  "keyId": "key123",
  "expiryDate": "2025-02-15T00:00:00Z"
}
```

**Response:**
```json
{
  "oldKey": "eak_4f3b9a8c...",
  "newKey": "eak_9d8e7f6a...",
  "expiresAt": "2025-02-15T00:00:00Z",
  "gracePeriod": "30 days"
}
```

---

### 3. Rate Limiting

**OAuth Endpoints:**
```
/oauth/authorize: 10 requests/minute per IP
/oauth/token: 5 requests/minute per client_id
```

**Admin API Endpoints:**
```
GET /api/users/*: 100 requests/minute per API key
POST /api/users/*/usage: 1000 requests/minute per API key
```

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1630000000
```

**Rate Limit Exceeded:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again in 60 seconds.",
  "retryAfter": 60
}
```

---

### 4. CORS Configuration

**User App (OAuth endpoints):**
```javascript
// Allow E-Cards origin
Access-Control-Allow-Origin: http://localhost:7300
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: true
```

**Admin API:**
```javascript
// Backend-to-backend, no CORS needed
// But if needed for future frontend calls:
Access-Control-Allow-Origin: http://localhost:7300
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

---

## WebSocket Subscriptions

### Real-Time Updates

**Purpose:** Notify E-Cards of subscription/limit changes in real-time

**Connection:**
```javascript
// E-Cards Backend connects to Admin API WebSocket
const ws = new WebSocket('ws://epicdev.com/admin/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    apiKey: process.env.EXTERNAL_API_KEY
  }));

  // Subscribe to all users (or specific users)
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'user.updates',
    filter: { application: 'ecards' }
  }));
});
```

**Message Types:**

#### 1. Subscription Changed
```json
{
  "type": "subscription.changed",
  "userId": "user123",
  "timestamp": "2024-11-15T14:30:00Z",
  "data": {
    "oldTier": "basic",
    "newTier": "professional",
    "ecardsEnabled": true,
    "effectiveDate": "2024-11-15T14:30:00Z"
  }
}
```

**E-Cards Action:** Update user subscription in database, refresh limits

---

#### 2. Limit Updated
```json
{
  "type": "limit.updated",
  "userId": "user123",
  "timestamp": "2024-11-15T14:30:00Z",
  "data": {
    "cardsPerMonth": 10000,
    "currentUsage": 2547,
    "llmCredits": 500,
    "resetDate": "2024-12-01T00:00:00Z"
  }
}
```

**E-Cards Action:** Update cached limits, allow/block operations accordingly

---

#### 3. Account Suspended
```json
{
  "type": "account.suspended",
  "userId": "user123",
  "timestamp": "2024-11-15T14:30:00Z",
  "data": {
    "reason": "payment_failed",
    "message": "Account suspended due to failed payment",
    "suspendedUntil": null
  }
}
```

**E-Cards Action:** Block all user operations, show suspension notice

---

#### 4. Credits Added
```json
{
  "type": "credits.added",
  "userId": "user123",
  "timestamp": "2024-11-15T14:30:00Z",
  "data": {
    "creditType": "llm",
    "amount": 100,
    "newBalance": 600,
    "reason": "purchase"
  }
}
```

**E-Cards Action:** Update LLM credits, enable parsing if previously disabled

---

## Error Responses

### Standard Error Format

**All errors follow this structure:**
```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context"
  },
  "timestamp": "2024-11-15T14:30:00Z",
  "requestId": "req_abc123"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_request` | 400 | Missing or invalid parameters |
| `unauthorized` | 401 | Invalid or missing API key |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `conflict` | 409 | Resource conflict (e.g., duplicate) |
| `rate_limit_exceeded` | 429 | Too many requests |
| `internal_error` | 500 | Server error |
| `service_unavailable` | 503 | Service temporarily unavailable |

### OAuth-Specific Errors

| Error | Description |
|-------|-------------|
| `invalid_client` | Invalid client_id or client_secret |
| `invalid_grant` | Invalid/expired authorization code |
| `invalid_scope` | Requested scope not allowed |
| `access_denied` | User denied consent |
| `unsupported_grant_type` | Grant type not supported |
| `invalid_token` | Invalid/expired access token |

---

## Testing & Integration

### Test Credentials

**For Development/Testing:**
```bash
# OAuth Client (User App)
OAUTH_CLIENT_ID=ecards_app_test
OAUTH_CLIENT_SECRET=test_secret_do_not_use_in_production

# Admin API Key
EXTERNAL_API_KEY=eak_test_4f3b9a8c7d6e5f4a3b2c1d0e9f8a7b6c
```

### Test User Accounts

**User App should provide test accounts:**
```json
{
  "users": [
    {
      "email": "test.free@example.com",
      "password": "Test123!",
      "tier": "free",
      "ecardsEnabled": false
    },
    {
      "email": "test.basic@example.com",
      "password": "Test123!",
      "tier": "basic",
      "ecardsEnabled": true,
      "limits": {
        "cardsPerMonth": 100,
        "currentUsage": 50
      }
    },
    {
      "email": "test.pro@example.com",
      "password": "Test123!",
      "tier": "professional",
      "ecardsEnabled": true,
      "limits": {
        "cardsPerMonth": 10000,
        "currentUsage": 0
      }
    },
    {
      "email": "test.suspended@example.com",
      "password": "Test123!",
      "tier": "basic",
      "status": "suspended"
    }
  ]
}
```

### Integration Testing Checklist

**User App (epicdev.com/app):**
- [ ] "E-Cards" button opens new tab to E-Cards
- [ ] OAuth authorize endpoint shows consent screen
- [ ] Consent approval redirects with authorization code
- [ ] Consent denial redirects with error
- [ ] Token exchange validates PKCE code_verifier
- [ ] Access tokens are valid JWT (RS256)
- [ ] Refresh token grant works correctly
- [ ] Token revocation invalidates tokens

**Admin API (epicdev.com/admin):**
- [ ] API key authentication works
- [ ] Invalid API key returns 401
- [ ] User profile endpoint returns correct data
- [ ] Subscription endpoint shows ecards_enabled correctly
- [ ] Rate limits endpoint shows current usage
- [ ] WebSocket connection accepts API key auth
- [ ] WebSocket sends subscription change events
- [ ] CORS headers allow E-Cards origin

### Postman Collection

**Example requests for testing:**

```json
{
  "info": {
    "name": "E-Cards Auto-Auth Testing",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Admin API - Get User",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{EXTERNAL_API_KEY}}"
          }
        ],
        "url": "http://epicdev.com/admin/api/users/{{userId}}"
      }
    },
    {
      "name": "Admin API - Get Subscription",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{EXTERNAL_API_KEY}}"
          }
        ],
        "url": "http://epicdev.com/admin/api/users/{{userId}}/subscription"
      }
    },
    {
      "name": "OAuth - Token Exchange",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/x-www-form-urlencoded"
          }
        ],
        "body": {
          "mode": "urlencoded",
          "urlencoded": [
            { "key": "grant_type", "value": "authorization_code" },
            { "key": "code", "value": "{{auth_code}}" },
            { "key": "redirect_uri", "value": "http://localhost:7300/auth/callback" },
            { "key": "client_id", "value": "ecards_app" },
            { "key": "client_secret", "value": "{{CLIENT_SECRET}}" },
            { "key": "code_verifier", "value": "{{code_verifier}}" }
          ]
        },
        "url": "http://epicdev.com/app/oauth/token"
      }
    }
  ]
}
```

---

## Summary

### Required Implementation by Remote Systems

**User App (epicdev.com/app):**
1. ✅ Add "E-Cards" button/link to user dashboard
2. ✅ Implement OAuth 2.0 Authorization Server:
   - `GET /oauth/authorize` (user consent)
   - `POST /oauth/token` (token exchange)
   - `POST /oauth/revoke` (token revocation)
   - `GET /.well-known/jwks.json` (public keys)
3. ✅ Support PKCE (code_challenge, code_verifier validation)
4. ✅ Issue RS256 JWT tokens with user claims
5. ✅ Register E-Cards client credentials
6. ✅ Configure CORS for E-Cards origin

**Admin API (epicdev.com/admin):**
1. ✅ Implement API key authentication
2. ✅ Implement endpoints:
   - `GET /api/users/:userId` (profile)
   - `GET /api/users/:userId/subscription` (tier, features)
   - `GET /api/users/:userId/limits` (usage, limits)
   - `POST /api/users/:userId/verify` (permissions)
   - `POST /api/users/:userId/usage` (record events)
3. ✅ Implement WebSocket server at `/ws`
4. ✅ Send real-time events (subscription changes, limit updates)
5. ✅ Rate limiting on all endpoints
6. ✅ Provide test credentials and test user accounts

---

**Document Owner:** E-Cards Development Team
**Remote System Owner:** Epic Dev Team
**Next Review Date:** 2025-12-01

For questions or clarifications, contact: devops@codedg.com

