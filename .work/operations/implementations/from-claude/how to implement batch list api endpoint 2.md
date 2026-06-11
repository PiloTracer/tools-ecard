● Based on the existing batch implementation, here's how to get the list of batches
  programmatically:

  📡 Batch List API Endpoint

  Endpoint

  GET /api/batches

  Base URL: http://localhost:7200 (or your API server URL)

  ---
  🔧 Request Parameters

  All parameters are optional query strings:

  | Parameter | Type   | Default | Description
       |
  |-----------|--------|---------|-------------------------------------------------------    
  -----|
  | page      | number | 1       | Page number (1-indexed)
       |
  | limit     | number | 20      | Records per page (max 500)
       |
  | status    | string | -       | Filter by status: UPLOADED, PARSING, PARSED, LOADED,      
  ERROR |

  ---
  📦 Response Format

  {
    batches: Array<{
      id: string;                          // UUID
      fileName: string;                    // Original filename
      fileSize: number;                    // Bytes
      status: 'UPLOADED' | 'PARSING' | 'PARSED' | 'LOADED' | 'ERROR';
      errorMessage?: string | null;        // Only if status is ERROR
      createdAt: string;                   // ISO 8601
      updatedAt: string;                   // ISO 8601
      processedAt?: string | null;         // ISO 8601
      recordsCount?: number | null;        // Total records in batch
      recordsProcessed?: number | null;    // Records processed so far
      parsingStartedAt?: string | null;    // ISO 8601
      parsingCompletedAt?: string | null;  // ISO 8601
    }>,
    total: number,    // Total count (all pages)
    page: number,     // Current page
    limit: number     // Records per page
  }

  Note: Response is flat (not wrapped in { success: true, data: {...} })

  ---
  💻 Code Examples

  1. Vanilla JavaScript (Fetch API)

  async function getBatches(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = null
    } = options;

    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);

    const response = await fetch(
      `http://localhost:7200/api/batches?${params.toString()}`,
      {
        method: 'GET',
        credentials: 'include', // ⚠️ CRITICAL: Sends auth cookies
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch batches: ${response.statusText}`);
    }

    return await response.json();
  }

  // Usage
  const result = await getBatches({ page: 1, limit: 50, status: 'PARSED' });
  console.log(`Found ${result.total} batches`);
  console.log(`Page ${result.page} of ${Math.ceil(result.total / result.limit)}`);
  result.batches.forEach(batch => {
    console.log(`${batch.fileName}: ${batch.recordsCount} records`);
  });

  ---
  2. Using Existing API Client (Recommended)

  import { apiClient } from '@/shared/lib/api-client';

  interface GetBatchesOptions {
    page?: number;
    limit?: number;
    status?: 'UPLOADED' | 'PARSING' | 'PARSED' | 'LOADED' | 'ERROR';
  }

  async function getBatches(options: GetBatchesOptions = {}) {
    const { page = 1, limit = 20, status } = options;

    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);

    return await apiClient.get<{
      batches: Array<{
        id: string;
        fileName: string;
        fileSize: number;
        status: string;
        recordsCount?: number | null;
        // ... all fields
      }>;
      total: number;
      page: number;
      limit: number;
    }>(`/api/batches?${params.toString()}`);
  }

  // Usage
  const result = await getBatches({ status: 'PARSED' });
  console.log(`${result.batches.length} parsed batches`);

  ---
  3. React Hook (Copy from existing code)

  import { useQuery } from '@tanstack/react-query';
  import { apiClient } from '@/shared/lib/api-client';

  function useBatches(options: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}) {
    const { page = 1, limit = 20, status } = options;

    const { data, isLoading, error, refetch } = useQuery({
      queryKey: ['batches', page, limit, status],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (status) params.append('status', status);

        return await apiClient.get(`/api/batches?${params.toString()}`);
      },
      staleTime: 5000, // Cache 5 seconds
      retry: 2,
    });

    return {
      batches: data?.batches || [],
      total: data?.total || 0,
      page: data?.page || 1,
      limit: data?.limit || 20,
      totalPages: data ? Math.ceil(data.total / data.limit) : 0,
      isLoading,
      error,
      refetch,
    };
  }

  // Usage in component
  function MyComponent() {
    const { batches, total, isLoading } = useBatches({ status: 'PARSED' });

    if (isLoading) return <div>Loading...</div>;

    return (
      <div>
        <h2>{total} Parsed Batches</h2>
        {batches.map(batch => (
          <div key={batch.id}>
            {batch.fileName} - {batch.recordsCount} records
          </div>
        ))}
      </div>
    );
  }

  ---
  4. cURL (Testing)

  # Get all batches
  curl -X GET "http://localhost:7200/api/batches?page=1&limit=20" \
    -H "Cookie: ecards_auth=your-cookie-value" \
    -H "Content-Type: application/json"

  # Get only PARSED batches
  curl -X GET "http://localhost:7200/api/batches?status=PARSED" \
    -H "Cookie: ecards_auth=your-cookie-value" \
    -H "Content-Type: application/json"

  # Get large page
  curl -X GET "http://localhost:7200/api/batches?limit=100" \
    -H "Cookie: ecards_auth=your-cookie-value" \
    -H "Content-Type: application/json"

  ---
  🎯 Common Use Cases

  Get All Batches Ready for Export

  async function getBatchesReadyForExport() {
    const result = await getBatches({
      status: 'PARSED',  // Only fully parsed batches
      limit: 100         // Get more at once
    });

    return result.batches.filter(batch =>
      batch.recordsCount && batch.recordsCount > 0 // Has records
    );
  }

  Pagination Helper

  async function getAllBatches() {
    const allBatches = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await getBatches({ page, limit: 100 });
      allBatches.push(...result.batches);

      hasMore = allBatches.length < result.total;
      page++;
    }

    return allBatches;
  }

  Monitor Parsing Progress

  async function watchParsingBatches() {
    const result = await getBatches({ status: 'PARSING' });

    result.batches.forEach(batch => {
      if (batch.recordsCount && batch.recordsProcessed !== null) {
        const progress = Math.round(
          (batch.recordsProcessed / batch.recordsCount) * 100
        );
        console.log(`${batch.fileName}: ${progress}% 
  (${batch.recordsProcessed}/${batch.recordsCount})`);
      }
    });

    return result.batches;
  }

  // Poll every 5 seconds
  setInterval(watchParsingBatches, 5000);

  ---
  🔐 Authentication

  CRITICAL: You must include authentication cookies with the request:

  Browser (Fetch)

  credentials: 'include'  // ✅ Sends cookies automatically

  Server-Side (Node.js)

  const response = await fetch(url, {
    headers: {
      'Cookie': `ecards_auth=${authToken}`  // ✅ Manual cookie
    }
  });

  Postman/Insomnia

  1. Login first to get cookie
  2. Cookie will auto-attach to subsequent requests

  ---
  📊 Response Examples

  Success Response

  {
    "batches": [
      {
        "id": "7749eb6c-3255-431d-8615-cfac3540fd5a",
        "fileName": "contacts_nov2025.xlsx",
        "fileSize": 45678,
        "status": "PARSED",
        "errorMessage": null,
        "createdAt": "2025-11-26T15:18:57.000Z",
        "updatedAt": "2025-11-26T15:19:12.000Z",
        "processedAt": "2025-11-26T15:19:12.000Z",
        "recordsCount": 150,
        "recordsProcessed": 150,
        "parsingStartedAt": "2025-11-26T15:18:58.000Z",
        "parsingCompletedAt": "2025-11-26T15:19:12.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }

  Error Response (401 Unauthorized)

  {
    "error": "Authentication required",
    "code": "UNAUTHORIZED"
  }

  ---
  ⚡ Performance Notes

  - Caching: Default 5 seconds on frontend (React Query staleTime)
  - Database: Indexed query on userId + status + createdAt
  - Limit: Max 500 records per page (enforced server-side)
  - Speed: ~50-100ms for typical queries (<1000 batches)

  ---
  🔗 Related Endpoints

  // Get single batch details
  GET /api/batches/:batchId/status

  // Get batch statistics
  GET /api/batches/stats
  // Returns: { total, uploaded, parsing, parsed, loaded, error }

  // Get recent batches
  GET /api/batches/recent?limit=5

  // Delete batch
  DELETE /api/batches/:batchId

  ---
  🎁 Quick Copy-Paste Function

  // ✨ Ready to use anywhere
  import { apiClient } from '@/shared/lib/api-client';

  export async function getBatchList(filters?: {
    status?: 'UPLOADED' | 'PARSING' | 'PARSED' | 'LOADED' | 'ERROR';
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    params.append('page', (filters?.page || 1).toString());
    params.append('limit', (filters?.limit || 20).toString());
    if (filters?.status) params.append('status', filters.status);

    const result = await apiClient.get<{
      batches: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/api/batches?${params.toString()}`);

    return {
      ...result,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  // Usage
  const { batches, total, totalPages } = await getBatchList({ status: 'PARSED' });

  That's everything you need to programmatically access batches! 🚀