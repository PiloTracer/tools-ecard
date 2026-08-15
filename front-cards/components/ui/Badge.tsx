import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** icon node rendered before the label (never color-only — UIS-04) */
  icon?: ReactNode;
}

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-success-subtle text-status-success',
  warning: 'bg-warning-subtle text-status-warning',
  error: 'bg-error-subtle text-status-error',
  info: 'bg-info-subtle text-status-info',
  neutral: 'bg-surface-inset text-text-secondary',
};

/**
 * Badge — status pill. Semantic color always paired with label (and optional icon),
 * never color-only (UIS-04). Tokens: --status-* + --*-subtle backgrounds.
 */
export function Badge({ tone = 'neutral', icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      data-testid="ui-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
