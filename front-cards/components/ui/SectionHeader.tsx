import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  /** accordion/toggle mode: open state + callback */
  toggle?: { open: boolean; onToggle: () => void; controls: string; expandedLabel?: string; collapsedLabel?: string };
  level?: 1 | 2 | 3 | 4;
  className?: string;
}

/**
 * SectionHeader — section title + optional description + optional accordion
 * toggle (aria-expanded/aria-controls). Used by dashboard Subscription/Settings
 * expandable sections (SPEC §4/§6).
 */
export function SectionHeader({ title, description, toggle, level = 2, className }: SectionHeaderProps) {
  const HeadingTag = (`h${level}`) as 'h2';
  const autoId = useId();
  const controls = toggle?.controls ?? autoId;

  return (
    <div className={cn('flex w-full items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <HeadingTag className="text-lg font-semibold text-text-primary">{title}</HeadingTag>
        {description ? <p className="mt-0.5 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {toggle ? (
        <button
          type="button"
          onClick={toggle.onToggle}
          aria-expanded={toggle.open}
          aria-controls={controls}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-text-secondary hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="ui-section-toggle"
        >
          {toggle.open ? (toggle.expandedLabel ?? 'Collapse') : (toggle.collapsedLabel ?? 'Expand')}
          <svg
            className={cn('h-4 w-4 transition-transform', toggle.open && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
