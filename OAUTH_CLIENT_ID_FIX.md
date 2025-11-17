# OAuth Client ID Configuration - Fix Applied

**Date:** 2025-01-16
**Issue:** Mismatch between frontend and backend OAuth client IDs

---

## ❌ Problem Identified

The frontend and backend were configured with **different OAuth client IDs**:

```bash
# Frontend (.env.dev.example)
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app       # ❌ Wrong

# Backend (.env.dev.example)
OAUTH_CLIENT_ID=ecards_app_dev              # ✅ Correct (from Tools Dashboard)
```

This caused OAuth requests to fail because:
1. Frontend initiates OAuth with `client_id=ecards_app`
2. Backend tries to exchange token with `client_id=ecards_app_dev`
3. Tools Dashboard rejects the mismatch

---

## ✅ Fix Applied

Both frontend and backend now use the **same OAuth client ID**:

```bash
# Frontend (.env.dev.example)
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app_dev  # ✅ Fixed - matches backend

# Backend (.env.dev.example)
OAUTH_CLIENT_ID=ecards_app_dev              # ✅ Correct
OAUTH_CLIENT_SECRET=d9kCj6XEcyzZwRVve6WeUeN_BuAaA6MC  # ✅ Correct
```

---

## 🔧 Files Modified

### 1. `.env.dev.example`
Changed line 58:
```bash
# Before
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app

# After
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app_dev
```

### 2. `docker-compose.dev.yml`
Changed line 86:
```yaml
# Before
NEXT_PUBLIC_OAUTH_CLIENT_ID: ${NEXT_PUBLIC_OAUTH_CLIENT_ID:-ecards_app}

# After
NEXT_PUBLIC_OAUTH_CLIENT_ID: ${NEXT_PUBLIC_OAUTH_CLIENT_ID:-ecards_app_dev}
```

---

## 📋 Understanding OAuth Client ID vs NEXT_PUBLIC_OAUTH_CLIENT_ID

### Why Two Variables?

In Next.js applications:

| Variable | Where Used | Why Needed |
|----------|-----------|------------|
| `NEXT_PUBLIC_OAUTH_CLIENT_ID` | **Frontend** (browser) | Needed to construct OAuth authorization URL that browser redirects to |
| `OAUTH_CLIENT_ID` | **Backend** (API routes) | Needed for server-side token exchange with OAuth server |

### Why Same Value?

Both variables represent the **same OAuth application** registered in Tools Dashboard, so they **MUST have the same value**:

```
┌─────────────────────────────────────────────────────┐
│  Tools Dashboard App Library                        │
│  ────────────────────────────────────              │
│  App Name: E-Cards                                  │
│  Client ID: ecards_app_dev              ◄───────  │
│  Client Secret: ZByCU4OQI7QxJqsv0EG1... │          │
└─────────────────────────────────────────────────────┘
                    │
                    │  Same value used in both places
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│  Frontend        │    │  Backend         │
│  (Browser)       │    │  (Server)        │
├──────────────────┤    ├──────────────────┤
│ NEXT_PUBLIC_     │    │ OAUTH_CLIENT_ID  │
│ OAUTH_CLIENT_ID  │    │ =ecards_app_dev │
│ =ecards_app_dev │    │                  │
│                  │    │ OAUTH_CLIENT_    │
│                  │    │ SECRET=ZByCU4... │
└──────────────────┘    └──────────────────┘
```

---

## 🔍 How to Verify the Fix

### 1. Check Environment Variables

```bash
# Check .env file
grep "OAUTH_CLIENT_ID" .env

# Should show (with same value):
# NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app_dev
# OAUTH_CLIENT_ID=ecards_app_dev
```

### 2. Check Docker Containers (if using Docker)

```bash
# Check frontend container
docker exec ecards-frontend env | grep NEXT_PUBLIC_OAUTH_CLIENT_ID

# Check backend container
docker exec ecards-api env | grep OAUTH_CLIENT_ID

# Both should show: ecards_app_dev
```

### 3. Check Browser Console During OAuth Flow

Open browser DevTools and watch for:

```
Generating OAuth authorization URL...
Client ID: ecards_app_dev
Full authorization URL: http://epicdev.com/oauth/authorize?...&client_id=ecards_app_dev...
```

### 4. Check Backend Logs During Token Exchange

Backend should log:

```
=== Token Exchange API Started ===
Client ID: ecards_app_dev
...
```

**Both should show the same `ecards_app_dev` value.**

---

## ⚠️ Common Mistakes to Avoid

### ❌ Mistake 1: Different Values

```bash
# ❌ WRONG - Different client IDs
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app
OAUTH_CLIENT_ID=ecards_app_dev
```

**Result:** OAuth flow fails with "invalid_client" or mismatch error

### ❌ Mistake 2: Missing NEXT_PUBLIC_ Prefix

```bash
# ❌ WRONG - Frontend needs NEXT_PUBLIC_ prefix
OAUTH_CLIENT_ID=ecards_app_dev  # Only works on backend
```

**Result:** Frontend can't access the value (shows as undefined)

### ❌ Mistake 3: Exposing Client Secret in Frontend

```bash
# ❌ WRONG - NEVER expose client secret to browser
NEXT_PUBLIC_OAUTH_CLIENT_SECRET=ZByCU4...  # Security risk!
```

**Result:** Client secret leaked to browser (security vulnerability)

### ✅ Correct Configuration

```bash
# ✅ CORRECT - Same client ID, secret only on backend
NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app_dev  # Frontend (browser)
OAUTH_CLIENT_ID=ecards_app_dev              # Backend (server)
OAUTH_CLIENT_SECRET=ZByCU4...                # Backend ONLY (never NEXT_PUBLIC_)
```

---

## 🔐 Security Notes

### What Gets Exposed to Browser

| Variable | Exposed? | Reason |
|----------|----------|--------|
| `NEXT_PUBLIC_OAUTH_CLIENT_ID` | ✅ Yes | Safe - Client ID is public in OAuth spec |
| `OAUTH_CLIENT_ID` | ❌ No | Server-side only |
| `OAUTH_CLIENT_SECRET` | ❌ **NEVER** | **Must remain secret** - never use NEXT_PUBLIC_ prefix |

### Why Client ID Can Be Public

According to OAuth 2.0 spec:
- **Client ID** is **public** and safe to expose in browser
- **Client Secret** is **confidential** and must never be exposed

This is why the OAuth authorization URL includes the client_id in the query string (visible to users):
```
https://epicdev.com/oauth/authorize?client_id=ecards_app_dev&...
```

---

## 📝 Quick Reference

### Environment Variables Checklist

- [ ] `NEXT_PUBLIC_OAUTH_CLIENT_ID` = `ecards_app_dev` (or your actual client ID)
- [ ] `OAUTH_CLIENT_ID` = `ecards_app_dev` (same value as above)
- [ ] `OAUTH_CLIENT_SECRET` = Your actual client secret from Tools Dashboard
- [ ] Both client IDs match exactly (case-sensitive)
- [ ] Client secret has NO `NEXT_PUBLIC_` prefix
- [ ] All values updated in `.env` file
- [ ] Docker containers rebuilt if using Docker

### After Making Changes

If you updated `.env`:

```bash
# Without Docker (local dev)
cd front-cards
npm run dev
# Hard refresh browser (Ctrl+Shift+R)

# With Docker
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build
```

---

## ✅ Summary

**What was wrong:**
- Frontend used `ecards_app` as client ID
- Backend used `ecards_app_dev` as client ID
- Mismatch caused OAuth to fail

**What was fixed:**
- Both now use `ecards_app_dev`
- Updated `.env.dev.example`
- Updated `docker-compose.dev.yml`
- Added comments explaining the requirement

**Action required:**
1. Update your `.env` file to match `.env.dev.example`
2. Ensure `NEXT_PUBLIC_OAUTH_CLIENT_ID` and `OAUTH_CLIENT_ID` have the same value
3. Restart dev server or rebuild Docker containers
4. Verify both values appear in logs during OAuth flow

---

**Status:** ✅ Fixed
**Files Modified:** `.env.dev.example`, `docker-compose.dev.yml`
**Breaking Change:** No - only fixes incorrect default value
**Rebuild Required:** Yes - after updating `.env` file
