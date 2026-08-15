import { cn } from './cn';

export interface ProgressProps {
  value: number;
  max?: number;
  /** tone shifts bar color (never sole signal — label/readout always present) */
  tone?: 'default' | 'warning' | 'error';
  label?: string;
  /** show "value / max" readout (default true) */
  showValue?: boolean;
  className?: string;
}

/**
 * Progress — usage/limit bar (native <progress> + tokens; value readout beside
 * the bar, never thumb/color-only). Mirrors dashboard usage bars.
 */
export function Progress({ value, max = 100, tone = 'default', label, showValue = true, className }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className={cn('w-full', className)}>
      {label || showValue ? (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
          {label ? <span className="text-text-secondary">{label}</span> : null}
          {showValue ? (
            <span className="font-medium text-text-primary">
              {value} / {max}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        data-testid="ui-progress"
        className="h-2 w-full overflow-hidden rounded-full bg-surface-inset"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            tone === 'default' && 'bg-accent',
            tone === 'warning' && 'bg-status-warning',
            tone === 'error' && 'bg-status-error',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
