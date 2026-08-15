import type { ReactNode } from 'react';
import { cn } from './cn';

export interface StatePanelProps {
  kind: 'loading' | 'error' | 'empty';
  title?: string;
  description?: ReactNode;
  /** action slot (e.g. Retry button / CTA) */
  action?: ReactNode;
  className?: string;
}

/**
 * StatePanel — loading / error / empty states (foundation doc 01 principle 1:
 * never a bare "Loading…" hang; errors explain + next action).
 * loading → aria-busy + role="status"; error → role="alert".
 */
export function StatePanel({ kind, title, description, action, className }: StatePanelProps) {
  const isError = kind === 'error';

  return (
    <div
      data-testid="ui-statepanel"
      role={isError ? 'alert' : kind === 'loading' ? 'status' : undefined}
      aria-busy={kind === 'loading' ? true : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border-subtle bg-surface-elevated px-6 py-10 text-center',
        className,
      )}
    >
      {kind === 'loading' ? (
        <svg
          className="h-6 w-6 animate-spin text-accent"
          viewBox="0 0 24 24"
          fill="none"
          role="presentation"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className={cn('h-6 w-6', isError ? 'text-status-error' : 'text-text-muted')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          role="presentation"
          aria-hidden="true"
        >
          {isError ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          )}
        </svg>
      )}
      {title ? <p className="font-medium text-text-primary">{title}</p> : null}
      {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
