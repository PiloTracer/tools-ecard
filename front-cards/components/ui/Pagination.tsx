'use client';

import { cn } from './cn';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
  /** sr-only label for the current page, e.g. "Page {n} of {m}" */
  pageIndicatorLabel?: string;
  className?: string;
}

/** Window of up to 5 page numbers around the current page (D5 pattern, mirrors legacy BatchList). */
function buildPages(page: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (page <= 3) {
    return [1, 2, 3, 4, 5];
  }
  if (page >= totalPages - 2) {
    return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
  }
  return Array.from({ length: 5 }, (_, i) => page - 2 + i);
}

/**
 * Pagination — numbered pager (prev/next + windowed pages, aria-current="page").
 * Numbered buttons hide on mobile (prev/next only); count kept on the page level.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  pageIndicatorLabel,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);
  const go = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== page) onPageChange(p);
  };

  const itemClasses = (active: boolean) =>
    cn(
      'inline-flex items-center px-3 py-2 text-sm font-medium',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      active
        ? 'bg-accent text-text-on-accent'
        : 'text-text-primary ring-1 ring-inset ring-border-default hover:bg-surface-inset',
    );

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-3', className)}>
      <span className="sr-only">{pageIndicatorLabel}</span>
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label={prevLabel}
        className={itemClasses(false)}
      >
        {prevLabel}
      </button>
      <div className="hidden items-center gap-1 sm:flex">
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? 'page' : undefined}
            className={itemClasses(p === page)}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        aria-label={nextLabel}
        className={itemClasses(false)}
      >
        {nextLabel}
      </button>
    </nav>
  );
}
