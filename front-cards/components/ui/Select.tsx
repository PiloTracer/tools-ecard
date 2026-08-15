import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/**
 * Select — native <select> + ds styles (CATALOG: native until a custom Select is
 * built; no dep). Label via htmlFor/id; aria-invalid on error.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-text-primary">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full appearance-none rounded-md border border-border-default bg-surface-inset px-3 py-2 pr-8 text-sm text-text-primary',
          'focus:outline-none focus:ring-2 focus:ring-accent',
          error ? 'border-status-error' : 'hover:border-border-strong',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        data-testid="ui-select"
      >
        {children}
      </select>
    </div>
  );
});
