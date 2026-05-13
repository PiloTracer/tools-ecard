'use client';

import type { ProjectsErrorDisplay } from '../types/errors';

type Props = {
  /** User-facing breakdown of what went wrong. */
  alert: ProjectsErrorDisplay;
  /** Standalone banner vs inset block vs sticky stripe (minimal chrome). */
  variant: 'banner' | 'inline' | 'ribbon';
};

/** Accessible notice for projects / API connectivity failures. */
export function ProjectsIssueAlert({ alert, variant }: Props) {
  const box =
    variant === 'banner'
      ? 'mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm'
      : variant === 'ribbon'
        ? 'rounded-lg border border-amber-300/70 bg-white/65 p-4 shadow-inner'
      : 'rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm';

  return (
    <div role="alert" className={box}>
      <div className={variant === 'banner' ? 'flex items-start gap-4' : 'flex items-start gap-3'}>
        <svg
          className="mt-0.5 h-6 w-6 shrink-0 text-amber-700"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">{alert.headline}</p>
          <p className="mt-1.5 leading-relaxed text-amber-900">{alert.body}</p>
          {alert.technicalHint ? (
            <details className="mt-4 text-sm text-amber-900/90 [&_svg]:transition-transform [&[open]_summary_svg]:rotate-90">
              <summary className="cursor-pointer list-none font-medium text-amber-900 underline decoration-amber-600/60 underline-offset-2 hover:text-amber-950">
                <span className="inline-flex items-center gap-1">
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  Technical details (for admins)
                </span>
              </summary>
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-white/70 p-3 text-xs leading-relaxed text-amber-950 ring-1 ring-amber-200/80">
                {alert.technicalHint}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
