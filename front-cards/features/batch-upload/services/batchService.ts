import {
  BatchUploadResponse,
  BatchStatusResponse,
  ListBatchesResponse,
  BatchStats,
  Batch,
  BatchStatus,
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

class BatchService {
  private getAuthHeaders(): HeadersInit {
    // In a real implementation, this would get the auth token from cookies or context
    return {
      'Authorization': `Bearer ${this.getAuthToken()}`,
    };
  }

  private getAuthToken(): string {
    // TODO: Get actual auth token from auth context or cookies
    if (typeof window !== 'undefined') {
      // Client-side: get from cookie or localStorage
      return document.cookie
        .split('; ')
        .find(row => row.startsWith('ecards_auth='))
        ?.split('=')[1] || '';
    }
    return '';
  }

  async uploadBatch(file: File): Promise<BatchUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/batches/upload`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload batch file');
    }

    return await response.json();
  }

  async getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
    const response = await fetch(`${API_URL}/api/batches/${batchId}/status`, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get batch status');
    }

    return await response.json();
  }

  async listBatches(params?: {
    status?: BatchStatus;
    page?: number;
    limit?: number;
  }): Promise<ListBatchesResponse> {
    const queryParams = new URLSearchParams();

    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }

    const url = `${API_URL}/api/batches${queryParams.toString() ? `?${queryParams}` : ''}`;

    const response = await fetch(url, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list batches');
    }

    return await response.json();
  }

  async deleteBatch(batchId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/batches/${batchId}`, {
      method: 'DELETE',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete batch');
    }
  }

  async retryBatch(batchId: string): Promise<BatchUploadResponse> {
    const response = await fetch(`${API_URL}/api/batches/${batchId}/retry`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to retry batch');
    }

    return await response.json();
  }

  async getBatchStats(): Promise<BatchStats> {
    const response = await fetch(`${API_URL}/api/batches/stats`, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get batch stats');
    }

    return await response.json();
  }

  async getRecentBatches(limit: number = 5): Promise<Batch[]> {
    const response = await fetch(`${API_URL}/api/batches/recent?limit=${limit}`, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get recent batches');
    }

    return await response.json();
  }

  // Mock implementations for development
  async uploadBatchMock(file: File): Promise<BatchUploadResponse> {
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate random success/failure (90% success)
    if (Math.random() > 0.9) {
      throw new Error('Mock upload failed');
    }

    return {
      id: `batch-${Date.now()}`,
      status: BatchStatus.UPLOADED,
      message: 'File uploaded successfully (mock)',
    };
  }

  async getBatchStatusMock(batchId: string): Promise<BatchStatusResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate different statuses randomly
    const statuses = [
      BatchStatus.UPLOADED,
      BatchStatus.PARSING,
      BatchStatus.PARSED,
      BatchStatus.LOADED,
      BatchStatus.ERROR,
    ];

    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      id: batchId,
      status: randomStatus,
      progress: randomStatus === BatchStatus.LOADED ? 100 : Math.floor(Math.random() * 80),
      errorMessage: randomStatus === BatchStatus.ERROR ? 'Mock error message' : null,
      fileName: 'contacts.csv',
      fileSize: 1024 * 512, // 512KB
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: randomStatus === BatchStatus.LOADED ? new Date() : null,
    };
  }
}

// Export singleton instance
export const batchService = new BatchService();