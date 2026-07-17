'use client';

/**
 * Render Job Status Badge
 * Displays the render progress for a batch record's card
 * Polls the render-status endpoint when active
 */

import { useState, useEffect, useCallback } from 'react';

interface RenderStatusProps {
  recordId: string;
  batchId: string;
  apiBaseUrl?: string;
  /** Required for server-side render retry (normal mode). */
  templateId?: string;
}

interface RenderStatusData {
  recordId: string;
  jobId?: string;
  status: string;
  progress: number;
  attemptsMade?: number;
  failedReason?: string;
}

type RenderState = 'idle' | 'loading' | 'active' | 'completed' | 'failed';

export function RenderStatusBadge({
  recordId,
  batchId,
  apiBaseUrl = '',
  templateId,
}: RenderStatusProps) {
  const [state, setState] = useState<RenderState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/batches/${batchId}/records/${recordId}/render-status`
      );
      const json = await res.json();

      if (json.success && json.data) {
        const data: RenderStatusData = json.data;
        setProgress(data.progress || 0);

        switch (data.status) {
          case 'active':
          case 'waiting':
          case 'delayed':
            setState('active');
            break;
          case 'completed':
            setState('completed');
            break;
          case 'failed':
            setState('failed');
            setError(data.failedReason || 'Render failed');
            break;
          default:
            setState('idle');
        }
      }
    } catch {
      // Silently handle — record may not have a render job yet
      setState('idle');
    }
  }, [recordId, batchId, apiBaseUrl]);

  // Poll while rendering is active
  useEffect(() => {
    if (state === 'idle' || state === 'active') {
      const interval = setInterval(checkStatus, 2000);
      // Defer initial fetch to avoid synchronous setState in effect
      const timeout = setTimeout(checkStatus, 0);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [state, checkStatus]);

  const handleRetry = useCallback(async () => {
    if (!templateId?.trim()) {
      setError('Template ID required to retry render');
      return;
    }
    setRetrying(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/batches/${batchId}/records/${recordId}/render-retry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: templateId.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Retry failed');
      }
      setError(null);
      setState('active');
      setProgress(0);
      void checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }, [apiBaseUrl, batchId, recordId, templateId, checkStatus]);

  if (state === 'idle') return null;

  if (state === 'active') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Rendering {progress}%
      </span>
    );
  }

  if (state === 'completed') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <svg className="-ml-1 mr-1.5 h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Rendered
      </span>
    );
  }

  if (state === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 cursor-help"
          title={error || 'Render failed'}
        >
          <svg className="-ml-1 mr-1.5 h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Failed
        </span>
        {templateId && (
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </span>
    );
  }

  return null;
}
