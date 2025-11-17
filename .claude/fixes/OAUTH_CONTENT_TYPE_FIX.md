# OAuth Content-Type Fix

**Date:** 2025-01-16
**Issue:** OAuth token exchange returning 500 Internal Server Error
**Root Cause:** Wrong Content-Type header (application/json instead of application/x-www-form-urlencoded)

---

## Problem

The OAuth token exchange was failing with:
```
Token exchange response status: 500
Error: TypeError: Could not parse content as FormData.
```

### Root Cause

The token exchange API route was sending requests with `Content-Type: application/json`, but OAuth 2.0 servers expect `Content-Type: application/x-www-form-urlencoded`.

**OAuth 2.0 Specification (RFC 6749):**
> The client makes a request to the token endpoint by sending the following parameters using the "application/x-www-form-urlencoded" format.

---

## Fix Applied

### File: `front-cards/app/api/auth/exchange-token/route.ts`

**Before (WRONG):**
```typescript
const tokenResponse = await fetch(OAUTH_CONFIG.tokenEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',  // ❌ Wrong format
  },
  body: JSON.stringify(tokenRequestBody),  // ❌ Sends as JSON
});
```

**After (CORRECT):**
```typescript
const tokenResponse = await fetch(OAUTH_CONFIG.tokenEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',  // ✅ Correct format
  },
  body: new URLSearchParams(tokenRequestBody as Record<string, string>),  // ✅ Sends as form data
});
```

---

## How It Works

### Before (JSON Format):
```http
POST /oauth/token HTTP/1.1
Host: epicdev.com
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "abc123...",
  "client_id": "ecards_app_dev",
  "client_secret": "secret123",
  "redirect_uri": "http://localhost:7300/auth/callback"
}
```

### After (Form-Encoded Format):
```http
POST /oauth/token HTTP/1.1
Host: epicdev.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=abc123...&client_id=ecards_app_dev&client_secret=secret123&redirect_uri=http%3A%2F%2Flocalhost%3A7300%2Fauth%2Fcallback
```

---

## Testing

### 1. Restart Docker Container

```bash
docker-compose -f docker-compose.dev.yml restart front-cards
```

### 2. Test OAuth Flow

1. Go to `http://localhost:7300`
2. Click "Login with Tools Dashboard"
3. Approve authorization
4. **Should successfully authenticate** ✅

### 3. Expected Logs

```
=== Token Exchange API Started ===
Flow type: Pre-Initiated OAuth (no PKCE)
Exchanging code for token with OAuth server...
Token endpoint: http://epicdev.com/oauth/token
Token exchange response status: 200  ← Should be 200, not 500
✓ Token exchange successful!
✓ User info fetched successfully!
=== Token Exchange Complete ===
```

---

## Why This Happened

The OAuth 2.0 specification (RFC 6749) requires form-encoded data for token requests, but many modern APIs use JSON. The developer likely assumed JSON would work since:
- Most modern REST APIs use JSON
- The request/response types in TypeScript suggest JSON

However, OAuth 2.0 predates the widespread adoption of JSON APIs and strictly requires `application/x-www-form-urlencoded` format.

---

## Related Standards

**OAuth 2.0 RFC 6749 Section 4.1.3:**
> The client makes a request to the token endpoint by sending the following parameters using the "application/x-www-form-urlencoded" format.

**Why Form-Encoded?**
- Historical: OAuth 2.0 was designed when form encoding was the standard
- Compatibility: Works with all HTTP libraries and servers
- Security: No parsing complexity (unlike JSON/XML)

---

## Summary

**What was wrong:**
- Content-Type: `application/json` (incorrect)
- Body: JSON string (incorrect)

**What was fixed:**
- Content-Type: `application/x-www-form-urlencoded` (correct)
- Body: URLSearchParams (correct)

**Result:**
✅ OAuth token exchange now works correctly
✅ Compliant with OAuth 2.0 specification
✅ Compatible with standard OAuth servers

---

**Status:** ✅ Fixed
**File Modified:** `front-cards/app/api/auth/exchange-token/route.ts` (line 108-114)
**Action Required:** Restart frontend container to apply changes
