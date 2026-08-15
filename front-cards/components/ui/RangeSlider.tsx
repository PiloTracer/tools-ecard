'use client';

import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface RangeSliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** format the value readout (default: raw number) */
  formatValue?: (value: number) => string;
  showValue?: boolean;
}

/**
 * RangeSlider — custom-anatomy slider per CATALOG (C1): token track/thumb,
 * visible value readout (never thumb-position-only). Native <input type=range>
 * styled with ds classes (no dep) per owner native-first decision.
 */
export function RangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  showValue = true,
  className,
  ...props
}: RangeSliderProps) {
  const id = useId();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn('w-full', className)}>
      {label || showValue ? (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
          {label ? (
            <label htmlFor={id} className="text-text-secondary">
              {label}
            </label>
          ) : null}
          {showValue ? (
            <span className="font-medium text-text-primary">
              {formatValue ? formatValue(value) : value}
            </span>
          ) : null}
        </div>
      ) : null}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className={cn('h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-inset', className)}
        style={{
          // token track fill + accent thumb (custom anatomy, tokens only)
          background: `linear-gradient(to right, var(--accent-default) ${pct}%, var(--surface-inset) ${pct}%)`,
          accentColor: 'var(--accent-default)',
        }}
        data-testid="ui-rangeslider"
        {...props}
      />
    </div>
  );
}
