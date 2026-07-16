/**
 * API client for communication with api-server
 * Handles authentication via cookies
 *
 * Demo hard rule: mutating methods never leave the browser when isDemoMode().
 */

import { isDemoMode } from '@/features/demo/isDemoMode';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7200';

export class DemoModeWriteBlockedError extends Error {
  readonly code = 'demo_mode_readonly';

  constructor(method: string, path: string) {
    super(`Demo mode blocks ${method} ${path} — data stays in the browser only`);
    this.name = 'DemoModeWriteBlockedError';
  }
}

function assertDemoAllowsMutation(method: string, path: string): void {
  if (isDemoMode()) {
    throw new DemoModeWriteBlockedError(method, path);
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      credentials: 'include', // Send cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    assertDemoAllowsMutation('POST', path);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include', // Send cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    assertDemoAllowsMutation('PUT', path);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      credentials: 'include', // Send cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async delete<T>(path: string): Promise<T> {
    assertDemoAllowsMutation('DELETE', path);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      credentials: 'include', // Send cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async patch<T>(path: string, data: unknown): Promise<T> {
    assertDemoAllowsMutation('PATCH', path);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      credentials: 'include', // Send cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
