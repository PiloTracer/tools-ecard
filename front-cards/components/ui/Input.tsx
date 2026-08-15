import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** render as <textarea> */
  multiline?: boolean;
  hint?: string;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  multiline?: true;
  hint?: string;
}

/**
 * Input / Textarea — inset-surface field primitive (tokens: --surface-inset,
 * --border-*). Label associated via htmlFor/id; error via aria-invalid + describedby.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, multiline, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint && !error ? `${fieldId}-hint` : undefined;

  const baseClasses = cn(
    'w-full rounded-md border bg-surface-inset px-3 py-2 text-sm text-text-primary',
    'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent',
    error
      ? 'border-status-error focus:border-status-error'
      : 'border-border-default hover:border-border-strong',
    'disabled:cursor-not-allowed disabled:opacity-50',
    className,
  );

  if (multiline) {
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-text-primary">
            {label}
          </label>
        ) : null}
        <textarea
          // cast: shared props are a subset of textarea attrs
          {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId ?? hintId}
          className={cn(baseClasses, 'min-h-[80px] resize-y')}
          data-testid="ui-input"
        />
        {error ? (
          <p id={errorId} className="mt-1 text-sm text-status-error" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1 text-sm text-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-text-primary">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        className={baseClasses}
        data-testid="ui-input"
      />
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-status-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
