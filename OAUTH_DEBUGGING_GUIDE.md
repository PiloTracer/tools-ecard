# OAuth Implementation - Debugging & Testing Guide

**Last Updated:** 2025-01-16
**Status:** ✅ Enhanced with comprehensive logging and error handling

---

## 🔧 What Was Fixed

### Issue Identified
When the Tools Dashboard redirected users to the E-Cards app with OAuth parameters (like `?client_id=...&state=...&code_challenge=...`), the E-Cards app **did not detect or handle these parameters**, causing the "Login with Tools Dashboard" button to appear inactive.

### Changes Made

#### 1. **Landing Page (app/page.tsx)**
✅ Added OAuth parameter detection
✅ Auto-redirect to OAuth flow when parameters are present
✅ Better loading states and error handling
✅ Direct OAuth initiation from "Login" button

#### 2. **Login Page (app/login/page.tsx)**
✅ Detects OAuth parameters in URL
✅ Auto-initiates OAuth flow when parameters present
✅ Enhanced error display with detailed messages
✅ Console logging for debugging

#### 3. **OAuth Callback (app/oauth/complete/page.tsx)**
✅ Comprehensive logging at each step
✅ Better error messages with context
✅ State validation logging
✅ PKCE code verifier tracking

#### 4. **Token Exchange API (app/api/auth/exchange-token/route.ts)**
✅ Detailed logging of token exchange process
✅ Request/response logging
✅ Error tracking with full context
✅ Cookie setting confirmation

#### 5. **OAuth Utilities (shared/lib/oauth-utils.ts)**
✅ Step-by-step logging of PKCE generation
✅ State parameter tracking
✅ Authorization URL construction logging

---

## 🔍 How to Debug the OAuth Flow

### Step 1: Open Browser DevTools

1. Open Chrome/Edge DevTools (F12)
2. Go to the **Console** tab
3. Optionally filter by "oauth" or "auth"

### Step 2: Test the OAuth Flow

#### Scenario A: Direct Login (Manual)
1. Go to `http://localhost:7300`
2. Click "Login with Tools Dashboard"
3. Watch the console for:
   ```
   Generating OAuth authorization URL...
   Generated state: ...
   Generated PKCE code challenge: ...
   Stored OAuth data in sessionStorage
   Full authorization URL: http://epicdev.com/oauth/authorize?...
   ```
4. You should be redirected to Tools Dashboard

#### Scenario B: Auto-Initiated from Tools Dashboard
1. Go to Tools Dashboard
2. Click "Launch E-Cards" or similar
3. You'll be redirected to `http://localhost:7300/?client_id=...&state=...&code_challenge=...`
4. Watch the console for:
   ```
   OAuth parameters detected in URL - initiating OAuth flow...
   Initiating OAuth flow...
   Generating OAuth authorization URL...
   ```
5. App should auto-redirect to Tools Dashboard OAuth page

### Step 3: After Authorization

After you approve the OAuth request on Tools Dashboard, you'll be redirected to:
```
http://localhost:7300/oauth/complete?code=...&state=...
```

Watch the console for the complete flow:

```
=== OAuth Callback Handler Started ===
Current URL: http://localhost:7300/oauth/complete?code=...&state=...
URL Parameters: { code: '...' state: '...' }
Stored state: ...
Received state: ...
✓ State validation passed
Code verifier from storage: ...
✓ Code verifier found
Exchanging authorization code for access token...

=== Token Exchange API Started ===
Received token exchange request: { code: '...', codeVerifier: '...' }
✓ Validation passed
Exchanging code for token with OAuth server...
Token endpoint: http://epicdev.com/oauth/token
Token exchange response status: 200
✓ Token exchange successful!
Fetching user information...
User info response status: 200
✓ User info fetched successfully!
Setting secure cookies...
✓ All cookies set successfully!
=== Token Exchange Complete ===

✓ Token exchange successful!
Clearing OAuth data from sessionStorage...
✓ OAuth flow completed successfully!
=== Redirecting to dashboard ===
```

---

## ✅ OAuth Flow Checklist

Use this checklist to verify each step of the OAuth flow:

### Initial Page Load
- [ ] Page detects if user is already authenticated
- [ ] If authenticated, redirects to `/dashboard`
- [ ] If OAuth params in URL, auto-initiates OAuth flow
- [ ] Loading state shown during transitions

### Login Initiation
- [ ] State parameter generated (32 bytes, cryptographically secure)
- [ ] PKCE code verifier generated (64 chars)
- [ ] PKCE code challenge generated (SHA-256 hash)
- [ ] State and code verifier stored in sessionStorage
- [ ] Authorization URL constructed correctly
- [ ] Redirect to Tools Dashboard OAuth page

### OAuth Authorization (on Tools Dashboard)
- [ ] User sees requested scopes (profile, email, subscription)
- [ ] User can approve or deny
- [ ] After approval, redirect to E-Cards callback URL
- [ ] URL contains `code` and `state` parameters

### Callback Handling
- [ ] Code parameter extracted from URL
- [ ] State parameter extracted from URL
- [ ] State validated against stored state (CSRF protection)
- [ ] Code verifier retrieved from sessionStorage
- [ ] All parameters sent to `/api/auth/exchange-token`

### Token Exchange
- [ ] Backend receives code and code verifier
- [ ] Backend validates all required fields
- [ ] Backend calls Tools Dashboard token endpoint
- [ ] Backend receives access_token and refresh_token
- [ ] Backend fetches user info from Tools Dashboard
- [ ] Backend sets secure httpOnly cookies
- [ ] Success response sent to frontend

### Post-Authentication
- [ ] SessionStorage cleared (state, code_verifier)
- [ ] Redirect to `/dashboard`
- [ ] User data displayed correctly
- [ ] Subscription info shown
- [ ] Logout button works

---

## 🐛 Common Issues & Solutions

### Issue 1: "Login" button does nothing

**Symptoms:**
- Click "Login with Tools Dashboard" but nothing happens
- No redirect to Tools Dashboard

**Debug Steps:**
1. Open Console and look for errors
2. Check if `generateAuthorizationUrl()` is being called
3. Verify `OAUTH_CONFIG.authorizationEndpoint` is set correctly
4. Check if `window.location.href` assignment is working

**Possible Causes:**
- JavaScript error preventing redirect
- Popup blocker preventing redirect
- Invalid authorization endpoint URL

**Solution:**
Check console for errors. The authorization URL should look like:
```
http://epicdev.com/oauth/authorize?response_type=code&client_id=ecards_app_dev&redirect_uri=http%3A%2F%2Flocalhost%3A7300%2Fauth%2Fcallback&scope=profile+email+subscription&state=...&code_challenge=...&code_challenge_method=S256
```

---

### Issue 2: State mismatch error

**Symptoms:**
- Error: "Invalid state parameter. Possible CSRF attack."
- Redirected back to login page

**Debug Steps:**
1. Check console for stored state vs received state
2. Look for sessionStorage clearing between pages
3. Verify state parameter in callback URL

**Possible Causes:**
- SessionStorage was cleared during redirect
- State parameter tampered with
- Multiple OAuth flows running simultaneously

**Solution:**
```javascript
// Check sessionStorage in Console
sessionStorage.getItem('oauth_state')
// Should match the state in the callback URL
```

---

### Issue 3: Code verifier not found

**Symptoms:**
- Error: "Missing PKCE code verifier"
- Cannot complete token exchange

**Debug Steps:**
1. Check if code verifier was stored: `sessionStorage.getItem('code_verifier')`
2. Verify it wasn't cleared prematurely
3. Check if sessionStorage is available

**Possible Causes:**
- SessionStorage cleared during navigation
- Browser privacy mode blocking sessionStorage
- Code running before sessionStorage is set

**Solution:**
Ensure sessionStorage is available and verify storage:
```javascript
console.log('Code verifier:', sessionStorage.getItem('code_verifier'));
```

---

### Issue 4: Token exchange fails

**Symptoms:**
- Error from backend: "Token exchange failed"
- HTTP 400 or 401 response

**Debug Steps:**
1. Check backend console logs for detailed error
2. Look at token exchange request body (logged in console)
3. Verify client_secret is configured correctly
4. Check if redirect_uri matches exactly

**Possible Causes:**
- Invalid or expired authorization code
- Code already used (codes are single-use)
- Client secret mismatch
- Redirect URI mismatch

**Solution:**
Check environment variables:
```bash
OAUTH_CLIENT_ID=ecards_app_dev
OAUTH_CLIENT_SECRET=h_auHylyxVBrBRpoJlS72JMhfiURJw2w
OAUTH_REDIRECT_URI=http://localhost:7300/oauth/complete,...
```

---

### Issue 5: User info fetch fails

**Symptoms:**
- Token exchange succeeds but user info fails
- HTTP 401 from user info endpoint

**Debug Steps:**
1. Check if access token was received
2. Verify access token is being sent in Authorization header
3. Check user info endpoint URL

**Possible Causes:**
- Access token invalid or expired
- Wrong user info endpoint URL
- Insufficient scopes granted

**Solution:**
Verify endpoint and token:
```javascript
// In backend logs, check:
console.log('User info endpoint:', OAUTH_CONFIG.userInfoEndpoint);
// Should be: http://epicdev.com/api/users/me
```

---

### Issue 6: Cookies not set

**Symptoms:**
- User info displayed in console but dashboard shows "not authenticated"
- Can't access protected routes

**Debug Steps:**
1. Open DevTools → Application → Cookies
2. Check for cookies: `ecards_auth`, `ecards_refresh`, `user_id`
3. Verify httpOnly flag is set on auth cookies

**Possible Causes:**
- Secure flag set but using HTTP
- SameSite policy blocking cookies
- Cookie domain mismatch

**Solution:**
Check cookie configuration in `.env`:
```bash
SESSION_COOKIE_SECURE=false  # Must be false for HTTP localhost
SESSION_COOKIE_SAME_SITE=strict
```

---

## 📊 Expected Console Output

### Successful OAuth Flow (Complete)

```
=== Landing Page ===
OAuth parameters detected in URL - initiating OAuth flow...
Using external state parameter: 1cc5a3a1e66f1aaa...

=== Login Page ===
Initiating OAuth flow...
Generating OAuth authorization URL...
Redirect URI: http://localhost:7300/oauth/complete
Client ID: ecards_app_dev
Scopes: ["profile", "email", "subscription"]
Generated state: a1b2c3d4e5f6...
Generated PKCE code verifier (first 10 chars): x7y8z9a0b1...
Generated PKCE code challenge: VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVk...
Stored OAuth data in sessionStorage
Full authorization URL: http://epicdev.com/oauth/authorize?...
Redirecting to OAuth authorization endpoint: http://epicdev.com/oauth/authorize?...

=== [User authorizes on Tools Dashboard] ===

=== Callback Page ===
=== OAuth Callback Handler Started ===
Current URL: http://localhost:7300/oauth/complete?code=AUTH_CODE_HERE&state=a1b2c3d4e5f6...
URL Parameters: {
  code: "SplxlOBeZQ...",
  state: "a1b2c3d4e5...",
  error: null,
  errorDescription: null
}
Stored state: a1b2c3d4e5f6...
Received state: a1b2c3d4e5f6...
✓ State validation passed
Code verifier from storage: x7y8z9a0b1...
✓ Code verifier found
Exchanging authorization code for access token...

=== Token Exchange API (Backend) ===
=== Token Exchange API Started ===
Received token exchange request: {
  code: "SplxlOBeZQ...",
  codeVerifier: "x7y8z9a0b1..."
}
✓ Validation passed
Exchanging code for token with OAuth server...
Token endpoint: http://epicdev.com/oauth/token
Client ID: ecards_app_dev
Redirect URI: http://localhost:7300/oauth/complete
Token exchange response status: 200
✓ Token exchange successful!
Received tokens: {
  access_token: "eyJhbGciOi...",
  refresh_token: "present",
  expires_in: 3600,
  scope: "profile email subscription"
}
Fetching user information...
User info endpoint: http://epicdev.com/api/users/me
User info response status: 200
✓ User info fetched successfully!
User: {
  id: "user123",
  username: "john_doe",
  email: "john@example.com",
  subscription: "professional"
}
Setting secure cookies...
Setting access token cookie: ecards_auth
Setting refresh token cookie: ecards_refresh
Setting user ID cookie: user_id
✓ All cookies set successfully!
=== Token Exchange Complete ===

=== Callback Page (Continued) ===
Token exchange response status: 200
Token exchange result: {
  success: true,
  user: { id: "user123", username: "john_doe", email: "john@example.com" },
  error: undefined
}
✓ Token exchange successful!
Clearing OAuth data from sessionStorage...
✓ OAuth flow completed successfully!
=== Redirecting to dashboard ===
```

---

## 🧪 Manual Testing Steps

### Test 1: Direct Login Flow

1. Clear cookies and sessionStorage
2. Go to `http://localhost:7300`
3. Click "Login with Tools Dashboard"
4. Verify redirect to `http://epicdev.com/oauth/authorize`
5. Approve scopes
6. Verify redirect to `http://localhost:7300/oauth/complete?code=...&state=...`
7. Verify automatic redirect to `/dashboard`
8. Verify user info displayed correctly

### Test 2: Auto-Initiated Flow (from Tools Dashboard)

1. Clear cookies and sessionStorage
2. Simulate Tools Dashboard redirect:
   ```
   http://localhost:7300/?client_id=ecards_app_dev&redirect_uri=http%3A%2F%2Flocalhost%3A7300%2Fauth%2Fcallback&scope=profile+email+subscription&code_challenge=ABC123&code_challenge_method=S256&state=XYZ789&response_type=code
   ```
3. Verify page detects OAuth parameters
4. Verify automatic redirect to Tools Dashboard OAuth page
5. Approve scopes
6. Complete flow as in Test 1

### Test 3: Error Handling

1. **Test state mismatch:**
   - Modify state parameter in callback URL
   - Verify error shown: "Invalid state parameter"

2. **Test missing code:**
   - Visit `/oauth/complete` without code parameter
   - Verify error shown: "No authorization code received"

3. **Test OAuth denial:**
   - Click "Deny" on Tools Dashboard OAuth page
   - Verify error shown on login page

---

## 📝 OAUTH_IMPLEMENTATION_GUIDE.md Compliance

### ✅ Implemented from Guide

- [x] **Client ID & Secret** - Configured in .env
- [x] **Redirect URIs** - Multiple URIs supported (comma-separated)
- [x] **Scopes** - profile, email, subscription
- [x] **PKCE** - Code verifier + challenge (SHA-256)
- [x] **State Parameter** - CSRF protection
- [x] **httpOnly Cookies** - Secure token storage
- [x] **Token Refresh** - Automatic refresh on 401
- [x] **User Info Endpoint** - Fetch user data after auth
- [x] **Error Handling** - User-friendly error messages

### 📋 Key Requirements Met

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| PKCE (S256) | ✅ | `oauth-utils.ts:generatePKCE()` |
| State Parameter | ✅ | `oauth-utils.ts:generateState()` |
| httpOnly Cookies | ✅ | `exchange-token/route.ts` |
| Token Exchange | ✅ | `exchange-token/route.ts` |
| Token Refresh | ✅ | `refresh-token/route.ts` |
| User Info Fetch | ✅ | `exchange-token/route.ts` |
| Error Handling | ✅ | All components |
| Logging | ✅ | Comprehensive throughout |

---

## 🚀 Next Steps

1. **Test the flow** - Follow the testing steps above
2. **Check console logs** - Verify all steps execute correctly
3. **Report any errors** - Provide console logs and error messages
4. **Verify cookies** - Check DevTools → Application → Cookies

---

## 📞 Support

If you encounter issues:

1. **Check console logs** - Look for errors or failed steps
2. **Verify environment variables** - Ensure all OAuth config is correct
3. **Check network tab** - Look for failed API requests
4. **Review this guide** - Check common issues section

---

**Status:** Ready for Testing
**Implementation:** Complete with comprehensive logging
**Compliance:** Fully follows OAUTH_IMPLEMENTATION_GUIDE.md
