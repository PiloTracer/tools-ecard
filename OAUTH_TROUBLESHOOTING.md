# OAuth Auto-Auth Troubleshooting Guide

**Issue:** User is redirected to `user-registration` page instead of completing OAuth flow

---

## ✅ Requirements Checklist

For OAuth authorization to work, ALL of these must be true:

### 1. User Account Requirements

- [ ] **User account exists** in Tools Dashboard
- [ ] **Email is verified** (check email for verification link)
- [ ] **Profile is complete** (all required fields filled)
- [ ] **User registration is complete** (not in pending/incomplete state)

**How to check:**
```
1. Log in to http://epicdev.com/app
2. Go to Profile/Settings
3. Verify all required fields are filled
4. Check for any "Complete your profile" warnings
```

### 2. OAuth Client Registration

- [ ] **E-Cards app is registered** in App Library
- [ ] **Client ID matches**: `ecards_app_dev`
- [ ] **Client secret is set** in E-Cards `.env` file
- [ ] **Redirect URIs are registered**:
  - `http://localhost:7300/auth/callback`
  - `http://localhost:7300/oauth/callback`

**How to check:**
```
1. Go to http://epicdev.com/app/features/app-library
2. Find E-Cards app
3. Click "Settings" or "Edit"
4. Verify:
   - Client ID: ecards_app_dev
   - Redirect URIs include: http://localhost:7300/auth/callback
   - App status: Active/Approved
```

### 3. User Authorization Status

- [ ] **User has not previously denied** this app
- [ ] **App is approved** for use (not pending review)
- [ ] **User session is valid** (logged in to Tools Dashboard)

**How to check:**
```
1. Go to http://epicdev.com/app/features/authorized-apps
2. Check if E-Cards is listed
3. If listed as "Denied", revoke and try again
```

### 4. Session & Cookies

- [ ] **Cookies are enabled** in browser
- [ ] **Not in incognito/private mode** (or cookies allowed)
- [ ] **No cookie blockers** interfering with epicdev.com cookies
- [ ] **User is logged in** to Tools Dashboard

**How to check:**
```
1. Open browser DevTools (F12)
2. Go to Application/Storage → Cookies
3. Check for epicdev.com cookies
4. Verify you're logged in: http://epicdev.com/app should show dashboard, not login
```

---

## 🔧 Diagnostic Steps

### Step 1: Verify User Registration Status

Run this check on Tools Dashboard backend:

```bash
# SSH into Tools Dashboard backend
docker exec -it back-auth bash

# Check user registration status (replace with actual user ID/email)
# This would be in your admin/debugging tools
```

Or check via UI:
1. Go to `http://epicdev.com/app/features/user-registration/status`
2. Should return JSON like:
   ```json
   {
     "registered": true,
     "email_verified": true,
     "profile_complete": true
   }
   ```

### Step 2: Check OAuth Client Configuration

Verify in App Library:

```
Client ID: ecards_app_dev
Redirect URIs:
  - http://localhost:7300/auth/callback
  - http://localhost:7300/oauth/callback
Scopes: profile, email, subscription
Status: Active
```

### Step 3: Test OAuth Flow Manually

Try accessing the authorization URL directly (after logging in):

```
http://epicdev.com/oauth/authorize?client_id=ecards_app_dev&redirect_uri=http%3A%2F%2Flocalhost%3A7300%2Fauth%2Fcallback&scope=profile+email+subscription&state=test123&response_type=code
```

**Expected:** Authorization consent screen
**Actual:** If redirected to user-registration, registration is incomplete

### Step 4: Check Browser Console

Open browser DevTools console and look for:
- JavaScript errors
- Failed network requests
- Cookie warnings

### Step 5: Check E-Cards Logs

Look for these specific log lines:

```javascript
// Should see in front-cards logs:
"OAuth parameters detected from Tools Dashboard"
"Pre-initiated OAuth detected - using provided parameters"
"Redirecting to: http://epicdev.com/oauth/authorize?..."
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Redirected to user-registration

**Cause:** User registration incomplete in Tools Dashboard

**Solution:**
1. Complete all required profile fields
2. Verify email address (check inbox for verification link)
3. Ensure no "pending" or "incomplete" status

**How to fix:**
```
1. Go to http://epicdev.com/app/features/user-registration
2. Complete all required steps
3. Verify email if needed
4. After completion, try OAuth flow again
```

### Issue 2: "invalid_client" error

**Cause:** Client ID doesn't exist or doesn't match

**Solution:**
1. Verify E-Cards app exists in App Library
2. Check client_id in App Library settings
3. Update E-Cards `.env` if needed:
   ```bash
   NEXT_PUBLIC_OAUTH_CLIENT_ID=ecards_app_dev
   OAUTH_CLIENT_ID=ecards_app_dev
   ```

### Issue 3: "redirect_uri_mismatch" error

**Cause:** Redirect URI not registered in App Library

**Solution:**
1. Go to App Library → E-Cards → Settings
2. Add redirect URI: `http://localhost:7300/auth/callback`
3. Save and try again

### Issue 4: OAuth loops back to login

**Cause:** User session not persisting or cookies blocked

**Solution:**
1. Clear browser cache and cookies for epicdev.com
2. Disable cookie blockers
3. Log in to Tools Dashboard
4. Try OAuth flow again

### Issue 5: "access_denied" error

**Cause:** User previously denied authorization

**Solution:**
1. Go to http://epicdev.com/app/features/authorized-apps
2. Find E-Cards app
3. Revoke authorization
4. Try OAuth flow again and click "Approve"

---

## 🔍 Debug Mode

### Enable Verbose Logging in E-Cards

Already enabled by default in development. Check browser console for:

```
OAuth parameters detected from Tools Dashboard
Parameters: {
  client_id: 'ecards_app_dev',
  state: '...',
  redirect_uri: 'http://localhost:7300/auth/callback',
  scope: 'profile email subscription',
  response_type: 'code'
}
```

### Check Tools Dashboard Logs

If you have access to Tools Dashboard backend logs:

```bash
docker logs -f back-auth --tail=100
docker logs -f front-public --tail=100
```

Look for:
- OAuth authorization requests
- User authentication status
- Redirect decisions

---

## 📝 Expected Flow (Successful)

```
1. User clicks "Launch app" in App Library
   → http://localhost:7300/?client_id=ecards_app_dev&...

2. E-Cards landing page detects OAuth params
   → Redirects to /login with params

3. E-Cards login page detects pre-initiated OAuth
   → Redirects to http://epicdev.com/oauth/authorize?...

4. Tools Dashboard checks:
   ✅ User is logged in
   ✅ User registration complete
   ✅ Client ID is valid
   ✅ Redirect URI is registered

5. Tools Dashboard shows authorization consent screen
   → "E-Cards wants to access your profile, email, subscription"

6. User clicks "Approve"
   → http://localhost:7300/auth/callback?code=...&state=...

7. E-Cards exchanges code for token
   → User logged in and redirected to dashboard
```

---

## 🎯 Quick Fix

**Most common cause:** User registration incomplete

**Quick test:**
1. Log in to http://epicdev.com/app
2. Go to http://epicdev.com/app/features/user-registration
3. Complete all steps if any are pending
4. After completion, try OAuth flow again

**If that doesn't work:**
1. Clear browser cookies for epicdev.com
2. Log in again to Tools Dashboard
3. Go to App Library
4. Click "Launch app" for E-Cards

---

## ✅ Success Indicators

You'll know OAuth is working when:

1. ✅ No redirect to user-registration page
2. ✅ See authorization consent screen instead
3. ✅ After clicking "Approve", redirected to E-Cards with code parameter
4. ✅ E-Cards logs show "Token exchange successful!"
5. ✅ Landed on E-Cards dashboard at http://localhost:7300/dashboard

---

## 📞 Still Not Working?

If you've completed all steps and OAuth still fails:

1. **Check Tools Dashboard backend logs** for specific OAuth errors
2. **Verify network connectivity** between E-Cards and Tools Dashboard
3. **Test with a different user account** to rule out account-specific issues
4. **Check Tools Dashboard admin panel** for any app-level restrictions

---

**Most likely issue:** User registration is incomplete. Complete all registration steps in Tools Dashboard first.
