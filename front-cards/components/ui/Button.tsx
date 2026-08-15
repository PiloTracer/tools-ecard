import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

/**
 * Button — token-bound primitive (accent focus ring, 4 variants, 2 sizes).
 * Per COMPONENT_STANDARD: consistent variant/size/disabled/className API, forwardRef.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-sm',
        variant === 'primary' &&
          'bg-accent text-text-on-accent hover:bg-accent-hover active:bg-accent-active',
        variant === 'secondary' &&
          'border border-border-default bg-surface-base text-text-primary hover:bg-surface-inset',
        variant === 'ghost' && 'text-text-primary hover:bg-surface-inset',
        variant === 'danger' &&
          'bg-status-error text-white hover:opacity-90 active:opacity-100',
        className,
      )}
      {...props}
    />
  );
});
