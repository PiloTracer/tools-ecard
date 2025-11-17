# CORS Fix Summary for simple-projects Feature

## Issue Resolved
Fixed CORS errors preventing the frontend (localhost:7300) from communicating with the API server (localhost:7400).

## Root Cause
The API server's CORS configuration was missing the `credentials: true` setting, which is required when the frontend makes requests with `credentials: 'include'`.

## Solution Applied

### File Modified: `api-server/src/app.ts`

Changed from:
```typescript
await app.register(cors, {
  origin: true, // TODO [backend]: Configure CORS properly for production
});
```

To:
```typescript
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests from the frontend development server
    const allowedOrigins = [
      'http://localhost:7300',
      'http://localhost:3000',
      'http://127.0.0.1:7300',
      'http://127.0.0.1:3000',
    ];

    // In development, allow the origin if it's in our allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else if (appConfig.env === 'development') {
      // In development, be more permissive but log unexpected origins
      console.warn(`CORS: Unexpected origin ${origin}`);
      cb(null, true);
    } else {
      // In production, be strict
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
});
```

## Key Changes

1. **Added `credentials: true`**: This is the critical fix that allows the browser to include cookies and credentials in cross-origin requests.

2. **Configured allowed origins**: Explicitly listed the frontend URLs that are allowed to make requests to the API.

3. **Added proper HTTP methods**: Included all necessary HTTP methods including OPTIONS for preflight requests.

4. **Set allowed headers**: Specified which headers can be sent in requests.

5. **Added exposed headers**: Defined which response headers the browser is allowed to access.

## Verification

After applying the fix and restarting the API server:

1. OPTIONS preflight requests now return:
   - `access-control-allow-credentials: true`
   - `access-control-allow-origin: http://localhost:7300`

2. GET and POST requests include proper CORS headers in responses.

3. The frontend can now successfully make authenticated requests to the API.

## Testing

You can verify the CORS configuration is working by:

1. Opening the browser developer console on the frontend (http://localhost:7300)
2. Checking that API calls no longer show CORS errors
3. Using the test file `test-cors.html` to verify endpoints

## Next Steps

While the CORS issue is resolved, you may still see 500 errors for the `/api/v1/projects/ensure-default` endpoint because it requires proper user authentication context. This is a separate issue from CORS and needs to be addressed by implementing proper authentication middleware in the API routes.

## Commands Used

```bash
# Restart API server to apply changes
docker-compose -f docker-compose.dev.yml restart api-server

# Verify CORS headers
curl -I -X OPTIONS http://localhost:7400/api/v1/projects \
  -H "Origin: http://localhost:7300" \
  -H "Access-Control-Request-Method: GET"
```