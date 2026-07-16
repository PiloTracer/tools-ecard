/**
 * Project Service - API Client
 */

import type {
  Project,
  ProjectsResponse,
  CreateProjectRequest,
  UpdateSelectedProjectRequest,
  UpdateProjectRequest,
  SelectedProjectResponse
} from '../types';

import { getApiBaseUrl } from '@/shared/lib/api-base-url';
import { ProjectsApiUserError } from './projectsApiUserError';
import { isDemoMode } from '@/features/demo/isDemoMode';
import { demoProjectRepository } from '@/features/demo/demoProjectRepository';

function throwConnectionProjectsError(url: string, caught: unknown): never {
  const detail =
    caught instanceof Error ? caught.message : caught != null ? String(caught) : '';
  const base = getApiBaseUrl();

  throw new ProjectsApiUserError({
    headline: 'Cannot connect to the E-Cards API',
    body:
      'Your browser did not get a response from the workspace server. Check your internet connection first. On a machine you control, confirm the E-Cards API service is running; in Docker dev this is usually the published URL on localhost (often port 7400).',
    technicalHint: [
      `API base URL (resolved): ${base}`,
      `Request: ${url}`,
      detail ? `Browser reported: ${detail}` : 'Browser reported: (no extra message)',
      '',
      'Browsers cannot resolve Docker Compose service names (e.g. api-server:4000). Use the host-reachable URL and published port (dev default is http://localhost:7400).',
      '',
      'Docker / local: verify api-server is running. If it exits on startup, check logs for App library storage integration HTTP 401—clear or fix APP_LIBRARY_STORAGE_INTEGRATION_KEY in repo-root .env, then restart.',
    ].join('\n'),
  });
}

function throwHttpProjectsError(
  url: string,
  status: number,
  parsed: { raw: string; message?: string }
): never {
  const excerpt = parsed.message || parsed.raw || `HTTP ${status}`;

  if (status === 401 || status === 403) {
    throw new ProjectsApiUserError({
      headline: 'Your session cannot load projects',
      body:
        'Signing in timed out or this browser is not authorised to use the workspace API right now. Sign out, sign back in using the Tools Dashboard, then return here.',
      technicalHint: [`HTTP ${status}`, `URL: ${url}`, excerpt.slice(0, 800)].join('\n'),
    });
  }

  if (status === 408) {
    throw new ProjectsApiUserError({
      headline: 'Request timed out',
      body:
        'The workspace server took too long to answer. Check your connection, then try again. If it keeps happening, try again when the network is quieter.',
      technicalHint: [`HTTP ${status}`, `URL: ${url}`, excerpt.slice(0, 800)].join('\n'),
    });
  }

  if (status === 429) {
    throw new ProjectsApiUserError({
      headline: 'Too many requests',
      body: 'The workspace service is limiting how often this action can run. Wait a minute and try refreshing the page.',
      technicalHint: [`HTTP ${status}`, `URL: ${url}`, excerpt.slice(0, 800)].join('\n'),
    });
  }

  if (status >= 500 && status < 600) {
    throw new ProjectsApiUserError({
      headline: 'The workspace service is unavailable',
      body:
        'The server encountered an unexpected problem while loading projects. Wait briefly and reload the page. If this continues, ask your administrator to check the api-server logs.',
      technicalHint: [`HTTP ${status}`, `URL: ${url}`, excerpt.slice(0, 800)].join('\n'),
    });
  }

  throw new ProjectsApiUserError({
    headline: 'Could not load workspaces',
    body:
      excerpt.length <= 280
        ? excerpt
        : 'The server replied with an error. Try reloading the page, or contact support with the technical details.',
    technicalHint: [`HTTP ${status}`, `URL: ${url}`, excerpt.slice(0, 1600)].join('\n'),
  });
}

function throwInvalidProjectsJson(url: string, parseErr: unknown): never {
  const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);

  throw new ProjectsApiUserError({
    headline: 'Unexpected response from the workspace server',
    body:
      'Projects data did not arrive in an expected format. Reload the page once. If the problem persists, the API behind this page may need to be inspected.',
    technicalHint: [`URL: ${url}`, `Parse detail: ${detail}`].join('\n'),
  });
}

class ProjectService {
  private async fetchWithAuth(url: string, options?: RequestInit) {
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> || {}),
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    const bodyDesc =
      options?.body == null
        ? 'none'
        : typeof options.body === 'string'
          ? `json, ${options.body.length} chars`
          : typeof options.body;

    console.log('[ProjectService] Request:', {
      url,
      method: options?.method || 'GET',
      headerKeys: Object.keys(headers),
      body: bodyDesc,
    });

    // Resolve network failures via .then so fetch does not reject the outer async stack frame as
    // TypeError: Failed to fetch (cleaner Turbopack / DevTools surfaced stack for callers).
    const attempt = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    }).then(
      (r): { ok: true; response: Response } | { ok: false; err: unknown } => ({
        ok: true as const,
        response: r,
      }),
      (err: unknown): { ok: true; response: Response } | { ok: false; err: unknown } => ({
        ok: false as const,
        err,
      }),
    );

    if (!attempt.ok) {
      throwConnectionProjectsError(url, attempt.err);
    }

    const response = attempt.response;

    console.log('[ProjectService] Response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ProjectService] Error response:', errorText);
      let serverMessage: string | undefined;
      try {
        const parsedJson = JSON.parse(errorText);
        const m =
          parsedJson?.error ??
          parsedJson?.message ??
          parsedJson?.detail ??
          parsedJson?.title;
        serverMessage =
          typeof m === 'string' ? m.trim() : Array.isArray(m) ? m.join(', ') : undefined;
      } catch {
        serverMessage =
          typeof errorText === 'string'
            ? errorText.trim().slice(0, 500) || undefined
            : undefined;
      }
      throwHttpProjectsError(url, response.status, {
        raw: errorText.slice(0, 800),
        message: serverMessage,
      });
    }

    const responseText = await response.text();
    console.log('[ProjectService] Success response:', responseText);

    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error('[ProjectService] Failed to parse response:', e);
      throwInvalidProjectsJson(url, e);
    }
  }

  async getProjects(): Promise<ProjectsResponse> {
    if (isDemoMode()) return demoProjectRepository.getProjects();
    const response = await this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects`);
    console.log('[ProjectService.getProjects] Response with phone fields:', response);
    return response;
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    if (isDemoMode()) return demoProjectRepository.createProject(data);
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSelectedProject(): Promise<SelectedProjectResponse> {
    if (isDemoMode()) return demoProjectRepository.getSelectedProject();
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/selected`);
  }

  async updateSelectedProject(data: UpdateSelectedProjectRequest): Promise<{ success: boolean; projectId: string }> {
    if (isDemoMode()) return demoProjectRepository.updateSelectedProject(data);
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/selected`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async ensureDefaultProject(): Promise<Project> {
    if (isDemoMode()) return demoProjectRepository.ensureDefaultProject();
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/ensure-default`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    if (isDemoMode()) return demoProjectRepository.updateProject(projectId, data);
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

export const projectService = new ProjectService();
