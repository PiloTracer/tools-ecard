/**
 * BatchStatusBadge — status pill via Badge primitive (icon + label, never color-only).
 * Tone map: UPLOADED=info, PARSING=warning, PARSED=info, LOADED=success, ERROR=error.
 */

'use client';

import React from 'react';
import type { BatchStatus } from '../types';
import { Badge, type BadgeTone } from '@/components/ui';
import { useTranslation } from '@/features/i18n';

interface BatchStatusBadgeProps {
  status: BatchStatus;
  className?: string;
}

const toneByStatus: Record<BatchStatus, BadgeTone> = {
  UPLOADED: 'info',
  PARSING: 'warning',
  PARSED: 'info',
  LOADED: 'success',
  ERROR: 'error',
};

export const BatchStatusBadge: React.FC<BatchStatusBadgeProps> = ({ status, className = '' }) => {
  const { t } = useTranslation();

  const icon = (() => {
    switch (status) {
      case 'UPLOADED':
        return (
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
        );
      case 'PARSING':
        return <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
      case 'PARSED':
      case 'LOADED':
        return (
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'ERROR':
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
  })();

  return (
    <Badge tone={toneByStatus[status]} icon={icon} className={className}>
      {t(`batches.status.${status.toLowerCase()}`)}
    </Badge>
  );
};
