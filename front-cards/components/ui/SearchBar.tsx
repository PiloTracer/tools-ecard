'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value?: string;
  onValueChange?: (value: string) => void;
  /** debounce for onDebouncedChange (default 300ms, matching RecordSearch) */
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
  clearable?: boolean;
  /** uncontrolled initial value (SearchBar is controlled once rendered) */
  defaultValue?: string;
}

/**
 * SearchBar — debounced search input (role="search", clearable).
 * Zero deps: internal timer debounce. Mirrors RecordSearch behavior (300ms).
 */
export function SearchBar({
  value,
  onValueChange,
  debounceMs = 300,
  onDebouncedChange,
  clearable = true,
  placeholder,
  defaultValue,
  className,
  ...props
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? '');
  const effectiveValue = value ?? internalValue;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Controlled prop sync — render-phase adjustment (React docs pattern, avoids
  // setState-in-effect cascades).
  if (value !== undefined && value !== internalValue) {
    setInternalValue(value);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (next: string) => {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onDebouncedChange?.(next), debounceMs);
  };

  return (
    <div role="search" className={cn('relative w-full', className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
        />
      </svg>
      <input
        type="search"
        value={effectiveValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? 'Search'}
        className={cn(
          'w-full rounded-md border border-border-default bg-surface-inset py-2 pl-9 pr-9 text-sm text-text-primary',
          'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent',
          className,
        )}
        data-testid="ui-search"
        {...props}
      />
      {clearable && effectiveValue ? (
        <button
          type="button"
          onClick={() => handleChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
