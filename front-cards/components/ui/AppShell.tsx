import type { ReactNode } from 'react';
import { cn } from './cn';

export interface AppShellProps {
  /** header region content (slot) */
  header: ReactNode;
  /** main content */
  children: ReactNode;
  /** optional footer region */
  footer?: ReactNode;
  /** optional banner rendered above the header (e.g. demo mode banner slot) */
  banner?: ReactNode;
  /** max-width container class; default max-w-7xl */
  containerClassName?: string;
}

/**
 * AppShell — shared page chrome (compound). Extracts the per-page header pattern
 * found in 4 hand-copied pages (foundation doc 03). Landmarks: <header>/<main>.
 */
export function AppShell({ header, children, footer, banner, containerClassName }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface-base">
      {banner}
      <header className="border-b border-border-subtle bg-surface-base shadow-elevation-1">
        <div className={cn('mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4', containerClassName)}>
          {header}
        </div>
      </header>
      <main className={cn('mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8', containerClassName)}>
        {children}
      </main>
      {footer ? (
        <footer className="border-t border-border-subtle">
          <div className={cn('mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4', containerClassName)}>
            {footer}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
