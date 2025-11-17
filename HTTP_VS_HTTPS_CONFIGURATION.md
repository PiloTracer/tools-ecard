# HTTP vs HTTPS Configuration Guide

**Last Updated:** 2025-01-16
**Issue:** OAuth endpoints were hardcoded with HTTPS, causing automatic protocol upgrades

---

## ✅ Problem Fixed

### Before (Hardcoded HTTPS)
The OAuth configuration was hardcoded with `https://` in the frontend code:

```typescript
// ❌ OLD - Hardcoded HTTPS
authorizationEndpoint: 'https://epicdev.com/oauth/authorize',
tokenEndpoint: 'https://epicdev.com/oauth/token',
userInfoEndpoint: 'https://epicdev.com/api/users/me',
```

**Result:** Even if you configured `http://` in environment variables, the frontend would use `https://`

### After (Configurable via Environment)
Now uses environment variables with full control over protocol:

```typescript
// ✅ NEW - Respects environment variables
authorizationEndpoint: process.env.NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT || 'http://epicdev.com/oauth/authorize',
tokenEndpoint: process.env.NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT || 'http://epicdev.com/oauth/token',
userInfoEndpoint: process.env.NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT || 'http://epicdev.com/api/users/me',
```

**Result:** Protocol is now fully controlled by your `.env` file!

---

## 🔧 How to Configure

### For HTTP (Development/Testing)

In your `.env` file:

```bash
# Frontend (browser-accessible, requires NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me

# Backend (server-side only)
OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me
```

### For HTTPS (Production)

In your `.env` file:

```bash
# Frontend (browser-accessible, requires NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=https://epicdev.com/oauth/authorize
NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT=https://epicdev.com/oauth/token
NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT=https://epicdev.com/api/users/me

# Backend (server-side only)
OAUTH_AUTHORIZATION_ENDPOINT=https://epicdev.com/oauth/authorize
OAUTH_TOKEN_ENDPOINT=https://epicdev.com/oauth/token
OAUTH_USER_INFO_ENDPOINT=https://epicdev.com/api/users/me
```

---

## 📋 Environment Variables Reference

### Frontend Variables (NEXT_PUBLIC_ prefix required)

These are accessible in the browser and must have the `NEXT_PUBLIC_` prefix:

| Variable | Example | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_OAUTH_CLIENT_ID` | `ecards_app_dev` | OAuth client ID (must match backend) |
| `NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT` | `http://epicdev.com/oauth/authorize` | Authorization endpoint |
| `NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT` | `http://epicdev.com/oauth/token` | Token endpoint (for reference) |
| `NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT` | `http://epicdev.com/api/users/me` | User info endpoint (for reference) |
| `NEXT_PUBLIC_EXTERNAL_AUTH_URL` | `http://epicdev.com/app` | External auth app URL |
| `NEXT_PUBLIC_USER_SUBSCRIPTION_URL` | `http://epicdev.com/app/features/user-subscription` | Subscription management URL |

### Backend Variables (Server-side only)

These are only accessible on the server:

| Variable | Example | Description |
|----------|---------|-------------|
| `OAUTH_CLIENT_ID` | `ecards_app_dev` | OAuth client ID (must match frontend) |
| `OAUTH_CLIENT_SECRET` | `d9kCj6XEcyzZwRVve6WeUeN_BuAaA6MC` | OAuth client secret (**KEEP SECRET!**) |
| `OAUTH_AUTHORIZATION_ENDPOINT` | `http://epicdev.com/oauth/authorize` | Authorization endpoint (backend reference) |
| `OAUTH_TOKEN_ENDPOINT` | `http://epicdev.com/oauth/token` | Token endpoint (backend calls) |
| `OAUTH_USER_INFO_ENDPOINT` | `http://epicdev.com/api/users/me` | User info endpoint (backend calls) |
| `OAUTH_REDIRECT_URI` | `http://localhost:7300/auth/callback,...` | Comma-separated redirect URIs |

---

## ⚙️ Configuration Files Modified

### 1. `front-cards/shared/lib/oauth-config.ts`
✅ Changed hardcoded HTTPS to environment variables
✅ Added `NEXT_PUBLIC_` prefix support
✅ Defaults remain HTTP for development

### 2. `.env.dev.example`
✅ Added `NEXT_PUBLIC_OAUTH_*` variables
✅ Added clear comments about HTTP/HTTPS handling
✅ Set defaults to HTTP for development

### 3. Backend API Routes (Already Correct)
✅ `app/api/auth/exchange-token/route.ts` - Uses env vars
✅ `app/api/auth/refresh-token/route.ts` - Uses env vars
✅ `app/api/auth/user/route.ts` - Uses env vars

---

## 🔍 How to Verify

### Step 1: Check Your `.env` File

Make sure your `.env` file has the correct protocol:

```bash
# For HTTP (development)
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize

# For HTTPS (production)
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=https://epicdev.com/oauth/authorize
```

### Step 2: Restart Your Development Server

**Important:** Next.js caches environment variables, so you must restart:

```bash
# Stop the dev server (Ctrl+C)
# Then restart
cd front-cards
npm run dev
```

### Step 3: Check Browser Console

When you click "Login with Tools Dashboard", check the console:

```
Generating OAuth authorization URL...
Full authorization URL: http://epicdev.com/oauth/authorize?...
```

The URL should match your configured protocol (HTTP or HTTPS).

### Step 4: Verify Redirect

When redirected to the OAuth server, verify the URL in your browser:
- ✅ Should be: `http://epicdev.com/oauth/authorize?...` (if you configured HTTP)
- ❌ Should NOT be: `https://epicdev.com/oauth/authorize?...` (unless you configured HTTPS)

---

## 🚨 Important Notes

### 1. Next.js Environment Variables

**Frontend variables require `NEXT_PUBLIC_` prefix:**
- ✅ `NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT` - Works in browser
- ❌ `OAUTH_AUTHORIZATION_ENDPOINT` - Only works on server

### 2. Restart Required

After changing `.env` file:
1. Stop the dev server
2. Restart with `npm run dev`
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

### 3. Cookie Security

If using HTTP in development:
```bash
SESSION_COOKIE_SECURE=false  # Must be false for HTTP
```

If using HTTPS in production:
```bash
SESSION_COOKIE_SECURE=true   # Must be true for HTTPS
```

### 4. Mixed Protocols

**Not recommended:** Using HTTP frontend with HTTPS backend or vice versa.

**Best practice:**
- Development: All HTTP
- Production: All HTTPS

---

## 🧪 Testing Different Protocols

### Test HTTP Configuration

1. Update `.env`:
   ```bash
   NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
   OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
   OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me
   ```

2. Restart dev server

3. Click "Login with Tools Dashboard"

4. Verify redirect is to `http://epicdev.com/oauth/authorize`

### Test HTTPS Configuration

1. Update `.env`:
   ```bash
   NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=https://epicdev.com/oauth/authorize
   OAUTH_TOKEN_ENDPOINT=https://epicdev.com/oauth/token
   OAUTH_USER_INFO_ENDPOINT=https://epicdev.com/api/users/me
   ```

2. Restart dev server

3. Click "Login with Tools Dashboard"

4. Verify redirect is to `https://epicdev.com/oauth/authorize`

---

## 📝 Summary

| Aspect | Before | After |
|--------|--------|-------|
| Frontend Config | Hardcoded HTTPS | Environment variable with `NEXT_PUBLIC_` |
| Backend Config | Environment variable ✅ | Environment variable ✅ |
| Protocol Control | ❌ No control | ✅ Full control via `.env` |
| Default Protocol | HTTPS | HTTP (development) |
| Requires Restart | N/A | ✅ Yes, after changing `.env` |

---

## 🎯 Quick Start

**To use HTTP (development):**

```bash
# 1. Copy to .env
cp .env.dev.example .env

# 2. Verify HTTP protocol in .env
grep "NEXT_PUBLIC_OAUTH_" .env
# Should show: http://epicdev.com/...

# 3. Restart dev server
cd front-cards
npm run dev
```

**To use HTTPS (production):**

```bash
# 1. Update .env to use https://
sed -i 's|http://epicdev.com|https://epicdev.com|g' .env

# 2. Update cookie security
# SESSION_COOKIE_SECURE=true

# 3. Rebuild and deploy
npm run build
```

---

**Status:** ✅ Fixed - Protocol now respects environment variables
**Breaking Change:** No - defaults remain HTTP for development
**Action Required:** Update `.env` file if you need HTTPS, then restart dev server
