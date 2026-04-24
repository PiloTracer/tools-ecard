'use client';

import { useTemplateStore } from '../../stores/templateStore';

type TemplateStatusProps = {
  /** One-line toolbar layout with smaller type */
  compact?: boolean;
};

export function TemplateStatus({ compact = false }: TemplateStatusProps) {
  const {
    currentProjectName,
    currentTemplateName,
    hasUnsavedChanges,
    lastSavedAt
  } = useTemplateStore();

  if (!currentTemplateName) {
    return (
      <div className="text-slate-500 italic text-xs sm:text-sm">
        Unsaved template
      </div>
    );
  }

  const formatLastSaved = () => {
    if (!lastSavedAt) return 'Never saved';

    const now = new Date();
    const saved = new Date(lastSavedAt);
    const diffMs = now.getTime() - saved.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Saved just now';
    if (diffMins === 1) return 'Saved 1 minute ago';
    if (diffMins < 60) return `Saved ${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'Saved 1 hour ago';
    if (diffHours < 24) return `Saved ${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Saved yesterday';
    return `Saved ${diffDays} days ago`;
  };

  const lineTitle = formatLastSaved();

  if (compact) {
    return (
      <div
        className="min-w-0 max-w-full sm:max-w-[min(100%,28rem)]"
        title={
          [currentProjectName, currentTemplateName, hasUnsavedChanges ? 'Unsaved changes' : null, lastSavedAt ? lineTitle : null]
            .filter(Boolean)
            .join(' · ') || undefined
        }
      >
        <p className="flex min-w-0 items-baseline gap-1.5 text-xs sm:text-sm">
          <span className="min-w-0 shrink truncate text-slate-200">
            {currentProjectName && (
              <>
                <span className="text-slate-500">{currentProjectName}</span>
                <span className="text-slate-500 mx-0.5">/</span>
              </>
            )}
            <span className="text-white font-medium">{currentTemplateName}</span>
          </span>
          {hasUnsavedChanges && <span className="shrink-0 text-amber-400">• Unsaved</span>}
          {lastSavedAt && (
            <span className="shrink-0 text-slate-500 hidden sm:inline sm:max-w-[7rem] sm:truncate" title={lineTitle}>
              {lineTitle}
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Template Name */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 text-sm font-medium text-white">
          {currentProjectName && (
            <>
              <span className="text-slate-400">{currentProjectName}</span>
              <span className="text-slate-500 mx-1">/</span>
            </>
          )}
          <span className="truncate">{currentTemplateName}</span>
        </span>
        {hasUnsavedChanges && (
          <span className="shrink-0 text-xs text-amber-400 font-medium">• Unsaved</span>
        )}
      </div>

      {lastSavedAt && (
        <div className="text-xs text-slate-500">
          {lineTitle}
        </div>
      )}
    </div>
  );
}