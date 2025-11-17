# Docker Compose OAuth Configuration Guide

**Last Updated:** 2025-01-16
**Issue Fixed:** OAuth environment variables not loaded in docker-compose

---

## ✅ What Was Fixed

The `docker-compose.dev.yml` file was missing all OAuth-related environment variables for both the frontend (`front-cards`) and backend (`api-server`) services.

### Before
- `front-cards`: Only had 3 environment variables (NODE_ENV, API_URL, WS_URL)
- `api-server`: Missing all OAuth configuration variables

### After
- ✅ `front-cards`: Added 6 OAuth frontend variables (with `NEXT_PUBLIC_` prefix)
- ✅ `api-server`: Added 20+ OAuth backend variables

---

## 📋 Environment Variables Added

### Frontend Service (`front-cards`)

OAuth variables accessible in the browser (require `NEXT_PUBLIC_` prefix):

```yaml
NEXT_PUBLIC_OAUTH_CLIENT_ID: ${NEXT_PUBLIC_OAUTH_CLIENT_ID:-ecards_app_dev}
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT: ${NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT:-http://epicdev.com/oauth/authorize}
NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT: ${NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT:-http://epicdev.com/oauth/token}
NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT: ${NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT:-http://epicdev.com/api/users/me}
NEXT_PUBLIC_EXTERNAL_AUTH_URL: ${NEXT_PUBLIC_EXTERNAL_AUTH_URL:-http://epicdev.com/app}
NEXT_PUBLIC_USER_SUBSCRIPTION_URL: ${NEXT_PUBLIC_USER_SUBSCRIPTION_URL:-http://epicdev.com/app/features/user-subscription}
```

### Backend Service (`api-server`)

OAuth configuration for server-side token exchange and validation:

#### Core OAuth Settings
```yaml
OAUTH_CLIENT_ID: ${OAUTH_CLIENT_ID:-ecards_app_dev}
OAUTH_CLIENT_SECRET: ${OAUTH_CLIENT_SECRET}  # No default - REQUIRED
OAUTH_AUTHORIZATION_ENDPOINT: ${OAUTH_AUTHORIZATION_ENDPOINT:-http://epicdev.com/oauth/authorize}
OAUTH_TOKEN_ENDPOINT: ${OAUTH_TOKEN_ENDPOINT:-http://epicdev.com/oauth/token}
OAUTH_USER_INFO_ENDPOINT: ${OAUTH_USER_INFO_ENDPOINT:-http://epicdev.com/api/users/me}
OAUTH_REDIRECT_URI: ${OAUTH_REDIRECT_URI:-http://localhost:7300/auth/callback}
OAUTH_SCOPES: ${OAUTH_SCOPES:-profile email subscription}
```

#### Application Identity
```yaml
APPLICATION_ID: ${APPLICATION_ID}  # No default - REQUIRED if using Admin API
EXTERNAL_API_KEY: ${EXTERNAL_API_KEY}  # No default - REQUIRED for backend-to-backend calls
USER_SUBSCRIPTION_URL: ${USER_SUBSCRIPTION_URL:-http://epicdev.com/app/features/user-subscription}
```

#### Security Settings
```yaml
TOKEN_ENCRYPTION_KEY: ${TOKEN_ENCRYPTION_KEY:-0000000000000000000000000000000000000000000000000000000000000000}
```

#### Cookie Configuration
```yaml
SESSION_COOKIE_NAME: ${SESSION_COOKIE_NAME:-ecards_auth}
REFRESH_COOKIE_NAME: ${REFRESH_COOKIE_NAME:-ecards_refresh}
SESSION_COOKIE_MAX_AGE: ${SESSION_COOKIE_MAX_AGE:-3600}
REFRESH_COOKIE_MAX_AGE: ${REFRESH_COOKIE_MAX_AGE:-2592000}
SESSION_COOKIE_SECURE: ${SESSION_COOKIE_SECURE:-false}
SESSION_COOKIE_HTTP_ONLY: ${SESSION_COOKIE_HTTP_ONLY:-true}
SESSION_COOKIE_SAME_SITE: ${SESSION_COOKIE_SAME_SITE:-strict}
```

#### PKCE & State Configuration
```yaml
PKCE_ENABLED: ${PKCE_ENABLED:-true}
PKCE_CODE_CHALLENGE_METHOD: ${PKCE_CODE_CHALLENGE_METHOD:-S256}
OAUTH_STATE_ENABLED: ${OAUTH_STATE_ENABLED:-true}
```

#### Rate Limiting
```yaml
AUTH_RATE_LIMIT_LOGIN_WINDOW: ${AUTH_RATE_LIMIT_LOGIN_WINDOW:-900000}
AUTH_RATE_LIMIT_LOGIN_MAX: ${AUTH_RATE_LIMIT_LOGIN_MAX:-5}
AUTH_RATE_LIMIT_CALLBACK_WINDOW: ${AUTH_RATE_LIMIT_CALLBACK_WINDOW:-900000}
AUTH_RATE_LIMIT_CALLBACK_MAX: ${AUTH_RATE_LIMIT_CALLBACK_MAX:-10}
AUTH_RATE_LIMIT_REFRESH_WINDOW: ${AUTH_RATE_LIMIT_REFRESH_WINDOW:-3600000}
AUTH_RATE_LIMIT_REFRESH_MAX: ${AUTH_RATE_LIMIT_REFRESH_MAX:-20}
```

---

## 🚀 How to Use

### 1. Ensure Your `.env` File is Updated

Make sure your `.env` file contains all the OAuth variables from `.env.dev.example`:

```bash
# Check if .env has OAuth variables
grep "OAUTH" .env

# If missing, copy from .env.dev.example
cp .env.dev.example .env
# Then update with your actual values
```

### 2. Update Required Variables

**Minimum required in `.env`:**

```bash
# Frontend (browser-accessible)
# IMPORTANT: Must match OAUTH_CLIENT_ID (same OAuth client)
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app_dev  # Must match backend client ID
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me

# Backend (server-side)
OAUTH_CLIENT_ID=ecards_app_dev  # Must match NEXT_PUBLIC_OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET=pQUQtR4fJLYH_9sfrPssE1Loz8HSeZ0D  # REQUIRED - Get from Tools Dashboard
OAUTH_REDIRECT_URI=http://localhost:7300/auth/callback

# Application Identity (if using Admin API)
APPLICATION_ID=dc03bc0c-1eb5-431a-bf2e-638c45b419b1  # Your app UUID
EXTERNAL_API_KEY=your_api_key_here  # If needed for backend-to-backend
```

### 3. Rebuild and Restart Docker Containers

**Important:** After updating `.env`, you must rebuild containers:

```bash
# Stop running containers
docker-compose -f docker-compose.dev.yml down

# Rebuild with new environment variables
docker-compose -f docker-compose.dev.yml up --build -d

# Or rebuild specific services
docker-compose -f docker-compose.dev.yml up --build front-cards api-server
```

### 4. Verify Environment Variables are Loaded

Check if variables are accessible in containers:

```bash
# Check frontend container
docker exec ecards-frontend env | grep NEXT_PUBLIC_OAUTH

# Check backend container
docker exec ecards-api env | grep OAUTH
```

**Expected output (frontend):**
```
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app_dev
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me
NEXT_PUBLIC_EXTERNAL_AUTH_URL=http://epicdev.com/app
NEXT_PUBLIC_USER_SUBSCRIPTION_URL=http://epicdev.com/app/features/user-subscription
```

**Expected output (backend):**
```
OAUTH_CLIENT_ID=ecards_app_dev
OAUTH_CLIENT_SECRET=pQUQtR4fJLYH_9sfrPssE1Loz8HSeZ0D
OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me
OAUTH_REDIRECT_URI=http://localhost:7300/auth/callback
...
```

---

## 🔍 Troubleshooting

### Issue 1: Variables Not Loading

**Symptoms:**
- OAuth still not working in Docker
- Console shows "undefined" for OAuth config
- Backend logs show "OAuth is not properly configured"

**Solution:**
1. Check `.env` file exists in project root
2. Verify variable names match exactly (case-sensitive)
3. Rebuild containers: `docker-compose -f docker-compose.dev.yml up --build`
4. Check container env: `docker exec ecards-frontend env | grep OAUTH`

### Issue 2: Client Secret Not Loading

**Symptoms:**
- Backend error: "OAUTH_CLIENT_SECRET is not configured"
- Token exchange fails

**Solution:**
```bash
# Ensure OAUTH_CLIENT_SECRET is in .env (no default value in docker-compose)
echo "OAUTH_CLIENT_SECRET=your_actual_secret_here" >> .env

# Rebuild api-server
docker-compose -f docker-compose.dev.yml up --build api-server
```

### Issue 3: Different Values in Container vs .env

**Symptoms:**
- `.env` has correct values but container shows old values
- Changes to `.env` not reflected in container

**Solution:**
```bash
# Docker caches environment variables
# Must rebuild containers to pick up new values

# Full rebuild
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build

# Or force recreate
docker-compose -f docker-compose.dev.yml up --force-recreate
```

### Issue 4: NEXT_PUBLIC_ Variables Not Working

**Symptoms:**
- Frontend can't access OAuth configuration
- Browser console shows "undefined" for NEXT_PUBLIC variables

**Solution:**
```bash
# Next.js requires rebuild for NEXT_PUBLIC_ variables
# They are embedded at build time, not runtime

# 1. Update .env with correct NEXT_PUBLIC_ variables
# 2. Rebuild frontend container
docker-compose -f docker-compose.dev.yml up --build front-cards

# 3. Hard refresh browser (Ctrl+Shift+R)
```

---

## 📝 Variable Precedence

Docker Compose uses this precedence (highest to lowest):

1. **Environment variables set in shell** (before running docker-compose)
2. **Variables in `.env` file** (recommended)
3. **Default values in docker-compose.yml** (fallback)

**Example:**
```bash
# If .env has:
OAUTH_CLIENT_ID=ecards_app_dev

# And docker-compose.dev.yml has:
OAUTH_CLIENT_ID: ${OAUTH_CLIENT_ID:-ecards_app_dev}

# Result: Container will use "ecards_app_dev" from .env
```

---

## ⚠️ Important Notes

### 1. NEXT_PUBLIC_ Prefix is Required for Frontend

**Browser-accessible variables MUST have `NEXT_PUBLIC_` prefix:**
- ✅ `NEXT_PUBLIC_OAUTH_CLIENT_ID` - Works in browser
- ❌ `OAUTH_CLIENT_ID` - Only works on server

### 2. Rebuild Required After .env Changes

After changing `.env`:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### 3. Some Variables Have No Defaults

These MUST be set in `.env`:
- `OAUTH_CLIENT_SECRET` - Required for token exchange
- `APPLICATION_ID` - Required if using Admin API
- `EXTERNAL_API_KEY` - Required for backend-to-backend calls

### 4. Production Deployment

For production, update these in `.env.prod`:
```bash
# Use HTTPS endpoints
NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT=https://epicdev.com/oauth/authorize
OAUTH_AUTHORIZATION_ENDPOINT=https://epicdev.com/oauth/authorize

# Enable secure cookies
SESSION_COOKIE_SECURE=true

# Use production client ID/secret
OAUTH_CLIENT_ID=ecards_app_prod
OAUTH_CLIENT_SECRET=your_production_secret_here
```

---

## ✅ Verification Checklist

After updating docker-compose and rebuilding:

- [ ] `.env` file exists and contains all OAuth variables
- [ ] Frontend container has `NEXT_PUBLIC_OAUTH_*` variables loaded
- [ ] Backend container has `OAUTH_*` variables loaded
- [ ] `OAUTH_CLIENT_SECRET` is set (no default value)
- [ ] Containers rebuilt with `--build` flag
- [ ] Browser console shows correct OAuth endpoint URLs
- [ ] Backend logs show OAuth configuration loaded
- [ ] OAuth login flow works end-to-end

---

## 🎯 Summary

| Service | Variables Added | Requires Rebuild | Notes |
|---------|----------------|------------------|-------|
| `front-cards` | 6 OAuth variables | ✅ Yes | All have `NEXT_PUBLIC_` prefix |
| `api-server` | 20+ OAuth variables | ✅ Yes | Includes secrets, cookies, PKCE, rate limiting |
| `.env` file | Must have all variables | N/A | Source of truth for all services |

---

**Status:** ✅ Fixed - All OAuth environment variables now loaded via docker-compose
**Action Required:** Update `.env` file, then rebuild containers with `--build` flag
**Verification:** Check container env with `docker exec ecards-frontend env | grep OAUTH`
