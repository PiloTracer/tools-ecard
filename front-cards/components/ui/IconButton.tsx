import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** accessible name — mandatory (a11y): pass t('...') or aria-label */
  'aria-label': string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'danger';
}

/**
 * IconButton — square icon-action button (toolbar/row actions). Tokens only.
 * aria-label is required by type (COMPONENT_STANDARD: no unlabelled icon buttons).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', variant = 'default', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-9 w-9',
        variant === 'default' && 'text-text-muted hover:bg-surface-inset hover:text-text-primary',
        variant === 'danger' && 'text-text-muted hover:bg-error-subtle hover:text-status-error',
        className,
      )}
      {...props}
    />
  );
});
