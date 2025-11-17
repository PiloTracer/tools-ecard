# Docker OAuth Network Configuration Fix

**Date:** 2025-01-16
**Issue:** OAuth token exchange timeout (Connect Timeout Error)
**Root Cause:** Docker containers unable to resolve `epicdev.com` to host machine
**Solution:** Added `extra_hosts` configuration to docker-compose.yml

---

## Problem Summary

The OAuth callback flow was failing with a network timeout error:

```
Token exchange error: TypeError: fetch failed
Error [ConnectTimeoutError]: Connect Timeout Error
(attempted addresses: 127.0.0.1:80, 90.0.0.1:80, timeout: 10000ms)
code: 'UND_ERR_CONNECT_TIMEOUT'
```

### Error Flow

1. User completes OAuth authorization on Tools Dashboard
2. User is redirected to `http://localhost:7300/auth/callback?code=xxx&state=yyy`
3. Frontend calls `/api/auth/exchange-token` API route
4. Backend API route (running inside Docker container) tries to exchange code with OAuth server
5. **Backend makes request to `http://epicdev.com/oauth/token`**
6. **Container cannot resolve `epicdev.com` correctly**
7. Request times out after 10 seconds

---

## Root Cause Analysis

### Host Configuration

On the Windows host machine, the hosts file contains:
```
127.0.0.1 epicdev.com
```

This means:
- Browser on host can access `http://epicdev.com` ✅
- Applications on host can access `http://epicdev.com` ✅
- **Docker containers CANNOT access `http://epicdev.com`** ❌

### Why Docker Containers Can't Access epicdev.com

Docker containers run in an isolated network namespace with their own:
- Network stack
- DNS resolver
- `/etc/hosts` file (separate from host)

By default, containers do NOT have access to the host's hosts file mappings.

When the backend API route (running in Docker) tried to fetch `http://epicdev.com/oauth/token`:
1. Container's DNS resolver tried to look up `epicdev.com`
2. DNS lookup failed or returned incorrect IP
3. Connection attempt timed out

---

## Solution: Docker `extra_hosts` Configuration

Docker Compose provides `extra_hosts` to add custom host-to-IP mappings in containers.

### What is `host-gateway`?

`host-gateway` is a special Docker Compose value that resolves to **the IP address of the host machine as seen from the container**.

- On Linux: Resolves to `172.17.0.1` (default Docker bridge gateway)
- On Windows/macOS: Resolves to special internal IP that routes to host
- This allows containers to access services running on the host machine

### Changes Made

#### 1. Updated `docker-compose.dev.yml`

Added `extra_hosts` to both `front-cards` and `api-server` services:

```yaml
  front-cards:
    build:
      context: ./front-cards
      dockerfile: Dockerfile.dev
    container_name: ecards-frontend
    extra_hosts:
      - "epicdev.com:host-gateway"  # Maps epicdev.com to host machine
    environment:
      # ... rest of config
```

```yaml
  api-server:
    build:
      context: ./api-server
      dockerfile: Dockerfile.dev
    container_name: ecards-api
    extra_hosts:
      - "epicdev.com:host-gateway"  # Maps epicdev.com to host machine
    environment:
      # ... rest of config
```

#### 2. Updated `.env.dev.example`

Changed backend OAuth endpoints to use `epicdev.com` (now that containers can resolve it):

```bash
# Backend OAuth Configuration (server-side only)
# NOTE: With extra_hosts in docker-compose.yml, epicdev.com resolves to host machine inside containers
OAUTH_CLIENT_ID=ecards_app_dev
OAUTH_CLIENT_SECRET=h_auHylyxVBrBRpoJlS72JMhfiURJw2w
OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me
OAUTH_REDIRECT_URI=http://localhost:7300/auth/callback
OAUTH_SCOPES=profile email subscription
```

---

## How It Works

### Network Flow After Fix

1. **Container tries to access `http://epicdev.com/oauth/token`**
2. **Docker injects host mapping:** Container's `/etc/hosts` now contains:
   ```
   <host-gateway-ip>  epicdev.com
   ```
   (e.g., `192.168.65.2 epicdev.com` on Docker Desktop)
3. **Container makes HTTP request to host machine**
4. **Host machine receives request**
5. **Host machine resolves `epicdev.com` using its hosts file:**
   ```
   127.0.0.1 epicdev.com
   ```
6. **Request reaches local OAuth server at `http://127.0.0.1`** ✅
7. **OAuth server responds with access token** ✅

### Visual Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Docker Container (front-cards)                                 │
│  ──────────────────────────────────────                        │
│                                                                  │
│  API Route: /api/auth/exchange-token                           │
│  ↓                                                               │
│  fetch('http://epicdev.com/oauth/token')                       │
│  ↓                                                               │
│  Container resolves epicdev.com using injected /etc/hosts      │
│  → epicdev.com = <host-gateway-ip>  (from extra_hosts)         │
│                                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP request to host
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Host Machine (Windows)                                         │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  Receives request for epicdev.com                              │
│  ↓                                                               │
│  Host resolves epicdev.com using Windows hosts file            │
│  → epicdev.com = 127.0.0.1                                     │
│  ↓                                                               │
│  Request reaches local OAuth server                             │
│  ↓                                                               │
│  OAuth server responds with access token                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### 1. Update Your `.env` File

Ensure your `.env` file matches `.env.dev.example`:

```bash
# Backend OAuth Configuration (server-side only)
OAUTH_CLIENT_ID=ecards_app_dev
OAUTH_CLIENT_SECRET=h_auHylyxVBrBRpoJlS72JMhfiURJw2w
OAUTH_AUTHORIZATION_ENDPOINT=http://epicdev.com/oauth/authorize
OAUTH_TOKEN_ENDPOINT=http://epicdev.com/oauth/token
OAUTH_USER_INFO_ENDPOINT=http://epicdev.com/api/users/me
OAUTH_REDIRECT_URI=http://localhost:7300/auth/callback
OAUTH_SCOPES=profile email subscription
```

### 2. Restart Docker Containers

The `extra_hosts` configuration requires recreating the containers:

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild and start (to apply extra_hosts)
docker-compose -f docker-compose.dev.yml up --build -d

# Or without detached mode to see logs
docker-compose -f docker-compose.dev.yml up --build
```

### 3. Verify Container Configuration

Check that the container has the correct host mapping:

```bash
# Check /etc/hosts inside the container
docker exec ecards-frontend cat /etc/hosts

# Should show something like:
# 127.0.0.1       localhost
# ::1             localhost ip6-localhost ip6-loopback
# ...
# 192.168.65.2    epicdev.com    # <-- This line should be present
```

### 4. Test Network Connectivity

Test that the container can reach the host's OAuth server:

```bash
# Test HTTP connectivity
docker exec ecards-frontend wget -O- http://epicdev.com 2>&1 || docker exec ecards-frontend curl -v http://epicdev.com 2>&1

# Should get HTTP response (even if 404 Not Found)
# The important part is that it connects (no timeout)
```

### 5. Test OAuth Flow

1. Go to `http://localhost:7300`
2. Click "Login with Tools Dashboard"
3. Approve on OAuth consent screen
4. **Should successfully redirect to dashboard** ✅

**Check backend logs:**
```bash
docker logs ecards-frontend -f
```

**Expected logs:**
```
=== Token Exchange API Started ===
Flow type: Pre-Initiated OAuth (no PKCE)
Exchanging code for token with OAuth server...
Token endpoint: http://epicdev.com/oauth/token
Token exchange response status: 200
✓ Token exchange successful!
✓ User info fetched successfully!
=== Token Exchange Complete ===
```

---

## Troubleshooting

### Issue: Still getting timeout error

**Check:**
1. Ensure you ran `docker-compose down` before `up --build`
2. Verify `extra_hosts` appears in container config:
   ```bash
   docker inspect ecards-frontend | grep -A5 ExtraHosts
   ```
3. Check that epicdev.com OAuth server is running on host machine:
   ```bash
   # On host machine
   curl http://epicdev.com/oauth/token
   # or
   curl http://127.0.0.1/oauth/token
   ```

### Issue: "Name or service not known"

**Check:**
```bash
docker exec ecards-frontend cat /etc/hosts
```

Should contain:
```
<some-ip>  epicdev.com
```

If missing, ensure:
- `extra_hosts` is in docker-compose.yml
- You restarted with `docker-compose down && docker-compose up --build`

### Issue: Connection refused

**Check:**
- OAuth server is running on host machine
- Server is listening on `0.0.0.0` (all interfaces), not just `127.0.0.1`
- Windows Firewall allows connections from Docker
- No port conflicts

---

## Production Considerations

In production, you would NOT use `epicdev.com` or hosts file mappings. Instead:

1. **Use real domain names** with proper DNS
2. **OAuth server URL** would be a real public URL like `https://auth.yourcompany.com`
3. **Remove `extra_hosts`** from docker-compose.yml (not needed for public domains)
4. **Use HTTPS** with valid SSL certificates

Example production `.env`:
```bash
OAUTH_AUTHORIZATION_ENDPOINT=https://auth.yourcompany.com/oauth/authorize
OAUTH_TOKEN_ENDPOINT=https://auth.yourcompany.com/oauth/token
OAUTH_USER_INFO_ENDPOINT=https://auth.yourcompany.com/api/users/me
```

---

## Summary

### What Was Wrong

Docker containers couldn't resolve `epicdev.com` to the host machine, causing OAuth token exchange to timeout.

### What We Fixed

Added `extra_hosts` configuration to docker-compose.yml, mapping `epicdev.com` to the host machine's IP address.

### Result

✅ Containers can now access `http://epicdev.com/*` URLs
✅ OAuth token exchange succeeds
✅ Pre-initiated OAuth flows work
✅ Manual login flows work
✅ Consistent URLs across frontend and backend

---

**Status:** ✅ Fixed
**Files Modified:**
- `docker-compose.dev.yml` (added extra_hosts to front-cards and api-server)
- `.env.dev.example` (updated backend OAuth endpoints to use epicdev.com)

**Action Required:**
1. Update your `.env` file to match `.env.dev.example`
2. Restart Docker containers: `docker-compose -f docker-compose.dev.yml down && docker-compose -f docker-compose.dev.yml up --build`
3. Test OAuth flow
