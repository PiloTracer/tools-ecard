'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** dialog title — required for a11y (aria-labelledby) unless ariaLabel is set */
  title?: string;
  ariaLabel?: string;
  /** close-button accessible label (default "Close"); pass t('common.close') when localized */
  closeLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** width: default md (max-w-lg), wide (max-w-3xl) */
  size?: 'md' | 'wide';
  className?: string;
}

/**
 * Modal — hand-rolled overlay dialog (zero deps): scrim token, focus trap,
 * Esc to close, body scroll lock, aria-labelledby. Native-first per owner
 * (CATALOG row, 2026-08-14).
 */
export function Modal({ open, onClose, title, ariaLabel, closeLabel = 'Close', children, footer, size = 'md', className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Keep the latest onClose without re-running the focus/scroll effect when the
  // parent passes an unstable callback identity (F8 focus-regression guard).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;

    // body scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // focus first focusable element
    const dialog = dialogRef.current;
    const focusables = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables?.[0];
    if (first) {
      first.focus();
    } else {
      dialog?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--scrim)' }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        tabIndex={-1}
        data-testid="ui-modal"
        className={cn(
          'flex w-full max-h-[calc(100vh-2rem)] flex-col rounded-xl bg-surface-overlay shadow-elevation-3 focus:outline-none',
          size === 'md' ? 'max-w-lg' : 'max-w-3xl',
          className,
        )}
      >
        {title ? (
          <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-6 py-4">
            <h2 id={titleId} className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-md p-1 text-text-muted hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        {/* Scrollable body: min-h-0 lets this flex child shrink below content size,
            so tall content (e.g. the 30+ field record edit form) scrolls inside the
            modal instead of running past the viewport while body scroll is locked. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-text-secondary">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
