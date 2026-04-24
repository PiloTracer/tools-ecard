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
};

/**
 * Number input that stores the raw string while focused so the user can clear the
 * field, type multi-digit values, and use the caret normally. The parent store is
 * only updated on blur / Enter, not on every keystroke.
 */
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

  useEffect(() => {
    if (resetKey !== undefined && resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      setText(formatValue(value, roundDisplay));
      return;
    }
    if (focused) return;
    setText(formatValue(value, roundDisplay));
  }, [value, focused, roundDisplay, resetKey]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      className={className}
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
}

function formatValue(v: number, round: boolean): string {
  if (round) return String(Math.round(v));
  if (Number.isInteger(v)) return String(v);
  return String(v);
}
