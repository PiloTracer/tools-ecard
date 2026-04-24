'use client';

import { useState, useEffect, useRef, useCallback, type InputHTMLAttributes } from 'react';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'onInput'
> & {
  /** External canonical value (e.g. from the store) */
  value: number;
  /** Called with a finite number when the user finishes editing (blur) or presses Enter */
  onCommit: (n: number) => void;
  /** When true, display and commit Math.round */
  roundDisplay?: boolean;
  /** Min / max applied on commit (optional) */
  min?: number;
  max?: number;
  /** Re-sync the visible string from `value` when this key changes (e.g. element id) */
  resetKey?: string | number;
  /** Show ± step buttons; uses `step` (default 1) without changing blur/enter commit behavior */
  withStepper?: boolean;
  step?: number;
};

/**
 * Number input that stores the raw string while focused so the user can clear the
 * field, type multi-digit values, and use the caret normally. The parent store is
 * only updated on blur / Enter, not on every keystroke.
 */
const inputBaseClassName =
  'min-w-0 flex-1 border-0 bg-white px-3 py-2 text-sm text-slate-800 font-medium ' +
  'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/35 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500';

const stepperShellClassName =
  'flex w-full min-w-0 items-stretch overflow-hidden rounded border border-gray-300 bg-white';

export function NumericStringInput({
  value,
  onCommit,
  roundDisplay = false,
  min,
  max,
  resetKey,
  className,
  disabled,
  onBlur: onBlurProp,
  onKeyDown: onKeyDownProp,
  withStepper = false,
  step: stepProp,
  ...rest
}: Props) {
  const [text, setText] = useState(() => formatValue(value, roundDisplay));
  const [focused, setFocused] = useState(false);
  const resetKeyRef = useRef(resetKey);
  const valueRef = useRef(value);
  valueRef.current = value;

  const commit = useCallback(() => {
    const raw = text.trim();
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      setText(formatValue(valueRef.current, roundDisplay));
      return;
    }
    let n = parseFloat(raw);
    if (Number.isNaN(n)) {
      setText(formatValue(valueRef.current, roundDisplay));
      return;
    }
    if (roundDisplay) n = Math.round(n);
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onCommit(n);
    setText(formatValue(n, roundDisplay));
  }, [text, onCommit, roundDisplay, min, max]);

  const step = stepProp !== undefined && stepProp > 0 ? stepProp : 1;

  const nudge = useCallback(
    (dir: 1 | -1) => {
      if (disabled) return;
      const raw = text.trim();
      let base = valueRef.current;
      if (raw !== '' && raw !== '-' && raw !== '.' && raw !== '-.') {
        const p = parseFloat(raw);
        if (!Number.isNaN(p)) base = p;
      }
      let n = base + dir * step;
      if (roundDisplay) n = Math.round(n);
      if (min !== undefined) n = Math.max(min, n);
      if (max !== undefined) n = Math.min(max, n);
      onCommit(n);
      setText(formatValue(n, roundDisplay));
    },
    [disabled, text, roundDisplay, min, max, onCommit, step]
  );

  useEffect(() => {
    if (resetKey !== undefined && resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      setText(formatValue(value, roundDisplay));
      return;
    }
    if (focused) return;
    setText(formatValue(value, roundDisplay));
  }, [value, focused, roundDisplay, resetKey]);

  const inputEl = (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      className={withStepper ? [inputBaseClassName, className].filter(Boolean).join(' ') : className}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false);
        commit();
        onBlurProp?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
        onKeyDownProp?.(e);
      }}
    />
  );

  if (!withStepper) {
    return inputEl;
  }

  const btnClass =
    'flex flex-1 min-h-0 items-center justify-center border-0 text-gray-600 transition-colors ' +
    'hover:bg-gray-100 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 ' +
    'text-[11px] font-semibold leading-none select-none';

  return (
    <div
      className={`${stepperShellClassName} ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      {inputEl}
      <div className="flex w-6 shrink-0 flex-col border-l border-gray-200">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Increase by one"
          className={`${btnClass} border-b border-gray-200 bg-slate-50/80`}
          onPointerDown={(e) => {
            e.preventDefault();
            nudge(1);
          }}
        >
          ▲
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Decrease by one"
          className={`${btnClass} bg-slate-50/80`}
          onPointerDown={(e) => {
            e.preventDefault();
            nudge(-1);
          }}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

function formatValue(v: number, round: boolean): string {
  if (round) return String(Math.round(v));
  if (Number.isInteger(v)) return String(v);
  return String(v);
}
