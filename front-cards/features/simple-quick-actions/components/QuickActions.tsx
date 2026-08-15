/**
 * QuickActions Component - Quick action buttons for dashboard
 *
 * Features:
 * - Three main actions: Template Designer, Import Batch, View Batches
 * - Project-based enabling: disabled when no project selected
 * - Visual feedback for disabled state
 */

'use client';

import React from 'react';
import { useProjects } from '@/features/simple-projects';
import { UploadBatchComponent } from '@/features/batch-upload';
import { useTranslation } from '@/features/i18n';
import type { QuickActionsProps } from '../index';

export function QuickActions({
  onCreateTemplate,
  onViewBatches,
  className = ''
}: QuickActionsProps) {
  const { t } = useTranslation();
  const { selectedProjectId, loading } = useProjects();

  // Buttons are disabled when no project is selected or still loading
  const isDisabled = !selectedProjectId || loading;

  const handleCreateTemplate = () => {
    if (!isDisabled && onCreateTemplate) {
      onCreateTemplate();
    }
  };

  const handleViewBatches = () => {
    if (!isDisabled && onViewBatches) {
      onViewBatches();
    }
  };

  // Common button classes with disabled state handling
  const getButtonClasses = () => {
    const baseClasses = "flex items-center p-4 border-2 border-dashed rounded-lg transition-all duration-200";

    if (isDisabled) {
      return `${baseClasses} border-border-default bg-surface-inset cursor-not-allowed opacity-50`;
    }

    return `${baseClasses} border-border-default hover:border-accent hover:bg-accent-subtle cursor-pointer`;
  };

  // Icon classes with disabled state
  const getIconClasses = () => {
    return isDisabled
      ? "w-6 h-6 text-text-muted mr-3"
      : "w-6 h-6 text-text-muted mr-3";
  };

  // Text classes with disabled state
  const getTitleClasses = () => {
    return isDisabled
      ? "font-medium text-text-muted"
      : "font-medium text-text-primary";
  };

  const getDescriptionClasses = () => {
    return isDisabled
      ? "text-sm text-text-muted"
      : "text-sm text-text-secondary";
  };

  return (
    <div className={`rounded-lg bg-surface-elevated p-6 shadow-elevation-2 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">{t('quickActions.title')}</h2>
        {isDisabled && !loading && (
          <span className="text-sm text-status-warning bg-warning-subtle px-2 py-1 rounded">
            {t('quickActions.selectProject')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Template Designer Button */}
        <button
          className={getButtonClasses()}
          onClick={handleCreateTemplate}
          disabled={isDisabled}
          aria-label={t('quickActions.templateDesigner')}
          title={isDisabled ? t('quickActions.selectProjectTitle') : t('quickActions.templateDesignerTitle')}
        >
          <svg
            className={getIconClasses()}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div className="text-left">
            <p className={getTitleClasses()}>{t('quickActions.templateDesigner')}</p>
            <p className={getDescriptionClasses()}>{t('quickActions.templateDesignerDesc')}</p>
          </div>
        </button>

        {/* Import Batch - Self-contained Upload Component */}
        <UploadBatchComponent />

        {/* View Batches Button */}
        <button
          className={getButtonClasses()}
          onClick={handleViewBatches}
          disabled={isDisabled}
          aria-label={t('quickActions.viewBatches')}
          title={isDisabled ? t('quickActions.selectProjectViewTitle') : t('quickActions.viewBatchesTitle')}
        >
          <svg
            className={getIconClasses()}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <div className="text-left">
            <p className={getTitleClasses()}>{t('quickActions.viewBatches')}</p>
            <p className={getDescriptionClasses()}>{t('quickActions.viewBatchesDesc')}</p>
          </div>
        </button>
      </div>

      {/* Loading State Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-surface-overlay/75 flex items-center justify-center rounded-lg">
          <div className="text-text-secondary">
            <svg className="animate-spin h-5 w-5 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">{t('quickActions.loadingProjects')}</span>
          </div>
        </div>
      )}
    </div>
  );
}