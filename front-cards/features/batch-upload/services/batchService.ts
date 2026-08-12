import {
  BatchUploadResponse,
  BatchStatusResponse,
  ListBatchesResponse,
  BatchStats,
  Batch,
  BatchStatus,
  FieldMappingEntry,
  FieldMappingPreset,
  MappingPreview,
} from '../types';

import { getApiBaseUrl } from '@/shared/lib/api-base-url';
import { isDemoMode } from '@/features/demo/isDemoMode';
import { demoBatchRepository } from '@/features/demo/demoBatchRepository';

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

  async uploadBatch(
    file: File,
    projectId: string,
    projectName: string,
    mapping?: FieldMappingEntry[]
  ): Promise<BatchUploadResponse> {
    if (isDemoMode()) return demoBatchRepository.uploadBatch(file, projectId, projectName, mapping);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('projectName', projectName);
    if (mapping && mapping.length > 0) {
      formData.append('mapping', JSON.stringify(mapping));
    }

    const response = await fetch(`${getApiBaseUrl()}/api/batches/upload`, {
      method: 'POST',
      credentials: 'include', // Include cookies for auth
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary for multipart
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload batch file');
    }

    return await response.json();
  }

  /**
   * Column-mapping preview (Pass 3): per-column auto-mapping + sample values +
   * suggested preset. Normal mode calls the API (Python parser --inspect);
   * Demo mode analyzes headers client-side with the demo parser.
   */
  async previewBatchFile(file: File): Promise<MappingPreview> {
    if (isDemoMode()) {
      const { parseDemoSpreadsheetFile, analyzeHeaders } = await import(
        '@/features/demo/demoSpreadsheetParser'
      );
      const { suggestDemoMappingPreset } = await import('@/features/demo/demoMappingPresets');
      const { getCanonicalTargetFields } = await import('../utils/canonicalTargetFields');
      const table = await parseDemoSpreadsheetFile(file);
      return {
        fileName: file.name,
        rowsTotal: table.rows.length,
        columns: analyzeHeaders(table),
        targetFields: getCanonicalTargetFields(),
        suggestedPreset: suggestDemoMappingPreset(table.headers),
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${getApiBaseUrl()}/api/batch-import/preview`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to preview batch file');
    }

    const body = await response.json();
    return body.data as MappingPreview;
  }

  /** Save a mapping preset (Pass 3): API in Normal mode, localStorage in Demo. */
  async saveMappingPreset(name: string, mapping: FieldMappingEntry[]): Promise<FieldMappingPreset> {
    if (isDemoMode()) {
      const { saveDemoMappingPreset } = await import('@/features/demo/demoMappingPresets');
      return saveDemoMappingPreset(name, mapping);
    }

    const response = await fetch(`${getApiBaseUrl()}/api/batch-import/mappings/presets`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mapping }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to save mapping preset');
    }

    const body = await response.json();
    return body.data as FieldMappingPreset;
  }

  async getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
    if (isDemoMode()) return demoBatchRepository.getBatchStatus(batchId);
    const response = await fetch(`${getApiBaseUrl()}/api/batches/${batchId}/status`, {
      credentials: 'include', // Include cookies for auth
      headers: {
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
    if (isDemoMode()) return demoBatchRepository.listBatches(params);
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

    const url = `${getApiBaseUrl()}/api/batches${queryParams.toString() ? `?${queryParams}` : ''}`;

    const response = await fetch(url, {
      credentials: 'include', // Include cookies for auth (cookie is httpOnly; Bearer below is best-effort)
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
    if (isDemoMode()) return demoBatchRepository.deleteBatch(batchId);
    const response = await fetch(`${getApiBaseUrl()}/api/batches/${batchId}`, {
      method: 'DELETE',
      credentials: 'include', // Include cookies for auth
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
    if (isDemoMode()) return demoBatchRepository.retryBatch(batchId);
    const response = await fetch(`${getApiBaseUrl()}/api/batches/${batchId}/retry`, {
      method: 'POST',
      credentials: 'include', // Include cookies for auth
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
    if (isDemoMode()) return demoBatchRepository.getBatchStats();
    const response = await fetch(`${getApiBaseUrl()}/api/batches/stats`, {
      credentials: 'include', // Include cookies for auth
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
    if (isDemoMode()) return demoBatchRepository.getRecentBatches(limit);
    const response = await fetch(`${getApiBaseUrl()}/api/batches/recent?limit=${limit}`, {
      credentials: 'include', // Include cookies for auth
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

  // Store mock batch states
  private mockBatchStates: Map<string, { status: BatchStatus; progress: number; startTime: number }> = new Map();

  async getBatchStatusMock(batchId: string): Promise<BatchStatusResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get or initialize batch state
    let batchState = this.mockBatchStates.get(batchId);

    if (!batchState) {
      // New batch - start with UPLOADED status
      batchState = {
        status: BatchStatus.UPLOADED,
        progress: 0,
        startTime: Date.now(),
      };
      this.mockBatchStates.set(batchId, batchState);
    }

    // Simulate realistic progression based on time elapsed
    const elapsed = Date.now() - batchState.startTime;

    // Progress through stages over ~12 seconds
    if (elapsed < 2000) {
      // First 2 seconds: UPLOADED
      batchState.status = BatchStatus.UPLOADED;
      batchState.progress = 10;
    } else if (elapsed < 6000) {
      // 2-6 seconds: PARSING
      batchState.status = BatchStatus.PARSING;
      batchState.progress = 10 + Math.floor((elapsed - 2000) / 40); // Progress to ~50
    } else if (elapsed < 9000) {
      // 6-9 seconds: PARSED
      batchState.status = BatchStatus.PARSED;
      batchState.progress = 60 + Math.floor((elapsed - 6000) / 30); // Progress to ~90
    } else {
      // After 9 seconds: LOADED (complete)
      batchState.status = BatchStatus.LOADED;
      batchState.progress = 100;
    }

    return {
      id: batchId,
      status: batchState.status,
      progress: Math.min(batchState.progress, 100),
      errorMessage: null,
      fileName: 'pasted-content.txt',
      fileSize: 1024 * 10, // 10KB
      createdAt: new Date(batchState.startTime),
      updatedAt: new Date(),
      processedAt: batchState.status === BatchStatus.LOADED ? new Date() : null,
    };
  }
}

// Export singleton instance
export const batchService = new BatchService();