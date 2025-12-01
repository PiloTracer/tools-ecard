'use client';

import { useTemplateStore } from '../../stores/templateStore';

export function TemplateStatus() {
  const {
    currentProjectName,
    currentTemplateName,
    hasUnsavedChanges,
    lastSavedAt
  } = useTemplateStore();

  if (!currentTemplateName) {
    return (
      <div className="text-sm text-slate-500 italic">
        Unsaved Template
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

  return (
    <div className="flex flex-col gap-1">
      {/* Template Name */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">
          {currentProjectName && (
            <>
              <span className="text-slate-400">{currentProjectName}</span>
              <span className="text-slate-500 mx-1">/</span>
            </>
          )}
          <span>{currentTemplateName}</span>
        </span>
        {hasUnsavedChanges && (
          <span className="text-xs text-amber-400 font-medium">
            • Unsaved changes
          </span>
        )}
      </div>

      {/* Last Saved */}
      {lastSavedAt && (
        <div className="text-xs text-slate-500">
          {formatLastSaved()}
        </div>
      )}
    </div>
  );
}