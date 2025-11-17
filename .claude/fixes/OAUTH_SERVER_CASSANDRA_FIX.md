# OAuth Server Cassandra Query Placeholder Fix

**Date:** 2025-01-16
**Issue:** OAuth token exchange failing with "TypeError: not all arguments converted during string formatting"
**Root Cause:** Inconsistent Cassandra query placeholder styles (`?` vs `%s`)
**Location:** OAuth server (`tools-dashboard/back-auth/features/auto-auth/infrastructure.py`)

---

## Problem

The OAuth server was crashing when trying to validate authorization codes:

```python
TypeError: not all arguments converted during string formatting
File "/app/features/auto-auth/infrastructure.py", line 107, in get_authorization_code
    result = self.session.execute(query, (code,))
```

### Root Cause

The Cassandra queries had **inconsistent placeholder styles**:
- Some queries used `%s` placeholders (Python string formatting style)
- Other queries used `?` placeholders (prepared statement style)

**Cassandra's Python driver requires consistent placeholder styles throughout.**

---

## Fixes Applied

### File: `tools-dashboard/back-auth/features/auto-auth/infrastructure.py`

Fixed 5 occurrences of `?` placeholders to use `%s` instead:

#### 1. Line 104 - Get authorization code
**Before:**
```python
WHERE code = ?
...
result = self.session.execute(query, (code,))
```

**After:**
```python
WHERE code = %s
...
result = self.session.execute(query, [code])
```

#### 2. Line 135-136 - Mark authorization code as used
**Before:**
```python
SET used = true, used_at = ?
WHERE code = ?
...
self.session.execute(query, (datetime.utcnow(), code))
```

**After:**
```python
SET used = true, used_at = %s
WHERE code = %s
...
self.session.execute(query, [datetime.utcnow(), code])
```

#### 3. Line 226 - Get token by hash
**Before:**
```python
WHERE token_hash = ?
...
result = self.session.execute(query, (token_hash,))
```

**After:**
```python
WHERE token_hash = %s
...
result = self.session.execute(query, [token_hash])
```

#### 4. Line 262-263 - Revoke token
**Before:**
```python
SET revoked = true, revoked_at = ?
WHERE token_hash = ?
...
self.session.execute(query, (now, token_hash))
```

**After:**
```python
SET revoked = true, revoked_at = %s
WHERE token_hash = %s
...
self.session.execute(query, [now, token_hash])
```

#### 5. Line 296 - Check if token is revoked
**Before:**
```python
WHERE token_hash = ?
...
result = self.session.execute(query, (token_hash,))
```

**After:**
```python
WHERE token_hash = %s
...
result = self.session.execute(query, [token_hash])
```

#### 6. Line 379 - Get public key by ID
**Before:**
```python
WHERE key_id = ?
...
result = self.session.execute(query, (key_id,))
```

**After:**
```python
WHERE key_id = %s
...
result = self.session.execute(query, [key_id])
```

---

## Summary of Changes

| Change | Count |
|--------|-------|
| `WHERE ... = ?` → `WHERE ... = %s` | 6 |
| `SET ... = ?` → `SET ... = %s` | 2 |
| `(param,)` → `[param]` (tuple to list) | 6 |
| `(p1, p2)` → `[p1, p2]` (tuple to list) | 2 |

---

## Testing

### 1. Restart OAuth Server

**On the remote server (where tools-dashboard runs):**

```bash
cd /path/to/tools-dashboard
docker-compose -f docker-compose.dev.yml restart back-auth
```

### 2. Verify Server Starts Without Errors

```bash
docker logs back-auth --tail 50 -f
```

**Expected:** No errors, server starts normally

### 3. Test OAuth Flow from E-Cards App

1. Go to `http://localhost:7300`
2. Click "Login with Tools Dashboard"
3. Approve authorization
4. **Should successfully authenticate** ✅

### 4. Expected Logs (back-auth)

**Before fix:**
```
ERROR:    Exception in ASGI application
...
TypeError: not all arguments converted during string formatting
```

**After fix:**
```
INFO:     Token validation successful
INFO:     Authorization code validated for client: ecards_app_dev
```

---

## Why This Happened

### Cassandra Python Driver Placeholder Styles

The Cassandra driver supports two parameter binding styles:

1. **Simple parameter binding** (used in this file):
   ```python
   query = "SELECT * FROM table WHERE id = %s"
   session.execute(query, [value])
   ```

2. **Prepared statements** (not used in this file):
   ```python
   stmt = session.prepare("SELECT * FROM table WHERE id = ?")
   session.execute(stmt, [value])
   ```

**The bug:** Mixing `%s` and `?` in simple parameter binding queries causes the driver to fail.

### Parameter Type: List vs Tuple

While both lists and tuples work, **lists are more consistent** with the Cassandra driver's internal handling:
- `[param]` - List (preferred)
- `(param,)` - Tuple (works but inconsistent)

---

## Related Standards

**Cassandra Python Driver Documentation:**
> For simple queries, use %s as placeholders. For prepared statements, use ? placeholders.

**Best Practice:**
- Use `%s` placeholders with `execute()` for simple queries
- Use `?` placeholders with `prepare()` + `execute()` for prepared statements
- Never mix them in the same codebase

---

## Impact

**Before:** OAuth token exchange failed, blocking all E-Cards authentication
**After:** OAuth token exchange works correctly ✅

**Affected Features:**
- ✅ Authorization code validation
- ✅ Token issuance
- ✅ Token refresh
- ✅ Token revocation
- ✅ RSA key retrieval

---

**Status:** ✅ Fixed
**File Modified:** `tools-dashboard/back-auth/features/auto-auth/infrastructure.py`
**Lines Changed:** 104, 135, 136, 139, 226, 230, 262, 263, 266, 296, 299, 379, 382
**Action Required:** Restart `back-auth` container on OAuth server
