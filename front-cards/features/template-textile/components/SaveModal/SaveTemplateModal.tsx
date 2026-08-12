'use client';

import { useState, useEffect } from 'react';
import { useTemplateStore } from '../../stores/templateStore';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (templateName: string, projectName: string, options?: { saveAsTemplate?: boolean; saveAsGlobal?: boolean }) => Promise<void>;
  currentTemplateName?: string;
  currentProjectName?: string;
  /** Set when the open document was opened from a template (Pass 4 fork semantics). */
  openedFromTemplateName?: string | null;
  /**
   * Pass 5: show the "Global (all users)" option for elevated roles only.
   * Deny by default — pass AuthContext.canManageGlobalTemplates (hidden in Demo).
   */
  canManageGlobalTemplates?: boolean;
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSave,
  currentTemplateName = '',
  currentProjectName = 'default',
  openedFromTemplateName = null,
  canManageGlobalTemplates = false
}: SaveTemplateModalProps) {
  const [templateName, setTemplateName] = useState(currentTemplateName);
  const [projectName, setProjectName] = useState(currentProjectName);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync fields every time the modal opens so Save always shows the current name.
  // Opened from a template: suggest "<name> copy" (the save forks a new design).
  useEffect(() => {
    if (!isOpen) return;
    setTemplateName(
      openedFromTemplateName ? `${openedFromTemplateName} copy` : currentTemplateName || ''
    );
    setProjectName(currentProjectName || 'default');
    setSaveAsTemplate(false);
    setSaveAsGlobal(false);
    setError(null);
  }, [isOpen, currentTemplateName, currentProjectName, openedFromTemplateName]);

  if (!isOpen) return null;

  const handleSave = async () => {
    // Validate inputs
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    // Sanitize names (basic validation)
    const sanitizedTemplate = templateName.trim().slice(0, 100);
    const sanitizedProject = projectName.trim().slice(0, 100);

    setIsSaving(true);
    setError(null);

    try {
      await onSave(sanitizedTemplate, sanitizedProject, {
        saveAsTemplate,
        // Global only applies to "Save as new template" and is only offered
        // to elevated roles — never send it otherwise (deny by default).
        ...(saveAsTemplate && canManageGlobalTemplates && saveAsGlobal ? { saveAsGlobal: true } : {})
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="bg-slate-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 pointer-events-auto"
          onKeyDown={handleKeyDown}
        >
          <h2 className="text-xl font-bold text-white mb-4">Save Template</h2>

          {/* Project Name Input */}
          <div className="mb-4">
            <label htmlFor="projectName" className="block text-sm font-medium text-slate-300 mb-2">
              Project Name
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Marketing Campaign"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSaving}
            />
            <p className="mt-1 text-xs text-slate-400">
              Organize your templates into projects
            </p>
          </div>

          {/* Template Name Input */}
          <div className="mb-4">
            <label htmlFor="templateName" className="block text-sm font-medium text-slate-300 mb-2">
              Template Name
            </label>
            <input
              id="templateName"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Business Card v2"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSaving}
              autoFocus
            />
          </div>

          {/* Fork hint when the document was opened from a template */}
          {openedFromTemplateName && !saveAsTemplate && (
            <p className="mb-4 text-xs text-slate-400">
              Opened from template &ldquo;{openedFromTemplateName}&rdquo; — saving creates a new
              design and leaves the template unchanged.
            </p>
          )}

          {/* Save as new template */}
          <div className="mb-4">
            <label htmlFor="saveAsTemplate" className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                id="saveAsTemplate"
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => {
                  setSaveAsTemplate(e.target.checked);
                  if (!e.target.checked) setSaveAsGlobal(false);
                }}
                disabled={isSaving}
                className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              Save as new template
            </label>
            <p className="mt-1 text-xs text-slate-400">
              Templates are reusable starting points: opening one and saving forks a new design.
            </p>
          </div>

          {/* Global (all users) — elevated roles only (Pass 5; hidden otherwise) */}
          {saveAsTemplate && canManageGlobalTemplates && (
            <div className="mb-4 ml-6">
              <label htmlFor="saveAsGlobal" className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  id="saveAsGlobal"
                  type="checkbox"
                  checked={saveAsGlobal}
                  onChange={(e) => setSaveAsGlobal(e.target.checked)}
                  disabled={isSaving}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
                Global (all users)
              </label>
              <p className="mt-1 text-xs text-slate-400">
                Global templates appear read-only in every user&rsquo;s gallery.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}