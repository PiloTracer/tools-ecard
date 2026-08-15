import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
}

/**
 * Toggle — two-state switch rendered as a button with aria-pressed (native-first,
 * zero deps). Visible state never color-only (text "On/Off" + icon).
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onCheckedChange, label, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        checked
          ? 'border-accent bg-accent text-text-on-accent hover:bg-accent-hover'
          : 'border-border-default bg-surface-base text-text-secondary hover:bg-surface-inset',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full border transition-colors',
          checked ? 'border-text-on-accent bg-text-on-accent' : 'border-border-strong bg-surface-inset',
        )}
        aria-hidden="true"
      />
      <span>{checked ? 'On' : 'Off'}</span>
    </button>
  );
});
