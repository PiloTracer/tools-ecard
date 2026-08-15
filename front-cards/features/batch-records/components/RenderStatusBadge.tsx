'use client';

/**
 * Render Job Status Badge
 * Displays the render progress for a batch record's card via the Badge primitive.
 * Polls the render-status endpoint while active; reports state changes upward so
 * the list can show a retry action on failure (retry itself lives in the row).
 */

import { useState, useEffect, useCallback } from 'react';
import { Badge, type BadgeTone } from '@/components/ui';
import { useTranslation } from '@/features/i18n';

interface RenderStatusProps {
  recordId: string;
  batchId: string;
  apiBaseUrl?: string;
  onStateChange?: (state: 'idle' | 'active' | 'completed' | 'failed') => void;
}

interface RenderStatusData {
  recordId: string;
  jobId?: string;
  status: string;
  progress: number;
  attemptsMade?: number;
  failedReason?: string;
}

export type RenderState = 'idle' | 'active' | 'completed' | 'failed';

export function RenderStatusBadge({
  recordId,
  batchId,
  apiBaseUrl = '',
  onStateChange,
}: RenderStatusProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<RenderState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const applyState = useCallback(
    (next: RenderState) => {
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange],
  );

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
            applyState('active');
            break;
          case 'completed':
            applyState('completed');
            break;
          case 'failed':
            setError(data.failedReason || t('records.renderStatus.failedReason'));
            applyState('failed');
            break;
          default:
            applyState('idle');
        }
      }
    } catch {
      // Silently handle — record may not have a render job yet
      applyState('idle');
    }
  }, [recordId, batchId, apiBaseUrl, applyState, t]);

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

  if (state === 'idle') return null;

  const tones: Record<RenderState, BadgeTone> = {
    idle: 'neutral',
    active: 'warning',
    completed: 'success',
    failed: 'error',
  };

  const icon = () => {
    if (state === 'active') {
      return (
        <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      );
    }
    if (state === 'completed') {
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (state === 'failed') {
      return (
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return null;
  };

  const label = () => {
    if (state === 'active') return t('records.renderStatus.rendering', { progress });
    if (state === 'completed') return t('records.renderStatus.rendered');
    return t('records.renderStatus.failed');
  };

  return (
    <Badge tone={tones[state]} icon={icon()} title={error ?? undefined}>
      {label()}
    </Badge>
  );
}
