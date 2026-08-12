'use client';

import { useState, useEffect } from 'react';
import { templateService, type TemplateMetadata } from '../../services/templateService';
import { bundledTemplatesService } from '../../services/bundledTemplatesService';

interface OpenTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (templateId: string) => Promise<void>;
  /**
   * Show edit affordances for API-served global templates (Pass 5).
   * Deny by default: pass AuthContext.canManageGlobalTemplates.
   */
  canManageGlobalTemplates?: boolean;
}

export function OpenTemplateModal({
  isOpen,
  onClose,
  onOpen,
  canManageGlobalTemplates = false
}: OpenTemplateModalProps) {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'template' | 'design'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Bundled globals ship as static assets and never throw — corrupt or
      // missing entries are skipped by the service with a console warning.
      const [templateList, bundledList] = await Promise.all([
        templateService.listTemplates(),
        bundledTemplatesService.listBundledTemplates()
      ]);
      setTemplates([...bundledList, ...templateList]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const isGlobal = (t: TemplateMetadata) => t.isPublic === true || t.isBundled === true;

  // Super-only affordance: delete an API-served global template for everyone.
  // Bundled globals are static files — remove them from public/templates/globals/ instead.
  const handleDeleteGlobal = async (e: React.MouseEvent, template: TemplateMetadata) => {
    e.stopPropagation();
    if (!window.confirm(`Delete global template "${template.name}" for all users?`)) return;
    setError(null);
    try {
      await templateService.deleteTemplate(template.id);
      if (selectedTemplateId === template.id) setSelectedTemplateId(null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete global template');
    }
  };

  const visibleTemplates = kindFilter === 'all'
    ? templates
    : templates.filter((t) => (t.kind ?? 'design') === kindFilter);

  const handleOpen = async () => {
    if (!selectedTemplateId) {
      setError('Please select a template to open');
      return;
    }

    setIsOpening(true);
    setError(null);

    try {
      await onOpen(selectedTemplateId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open template');
    } finally {
      setIsOpening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedTemplateId && !isOpening) {
      handleOpen();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Open Template
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Select a template to open
          </p>
          {/* Kind filter: Templates | My designs (All = previous behavior) */}
          <div className="flex gap-2 mt-3" role="group" aria-label="Filter by kind">
            {([
              { value: 'all', label: 'All' },
              { value: 'template', label: 'Templates' },
              { value: 'design', label: 'My designs' },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKindFilter(option.value)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  kindFilter === option.value
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading templates...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="ml-3 text-sm text-red-800">{error}</p>
              </div>
            </div>
          ) : visibleTemplates.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-sm text-gray-600">No templates found</p>
              <p className="mt-1 text-xs text-gray-500">Create a template first to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleTemplates.map((template) => (
                <div key={template.id} className="relative">
                  <div
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedTemplateId === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      {template.previewUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={template.previewUrl}
                          alt=""
                          className="w-12 h-12 mr-3 rounded border border-gray-200 object-cover shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {template.name}
                          </p>
                          <span
                            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              template.kind === 'template'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {template.kind === 'template' ? 'Template' : 'Design'}
                          </span>
                          {isGlobal(template) && (
                            <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                              Global
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{template.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Updated: {new Date(template.updatedAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Mode: {typeof template.storageMode === 'string'
                              ? template.storageMode
                              : (template.storageMode as any)?.mode || 'UNKNOWN'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            v{template.version}
                          </span>
                        </div>
                      </div>
                      {canManageGlobalTemplates && template.isPublic === true && !template.isBundled && (
                        <button
                          type="button"
                          title={`Delete global template "${template.name}" for all users`}
                          aria-label={`Delete global template ${template.name}`}
                          onClick={(e) => handleDeleteGlobal(e, template)}
                          className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                          </svg>
                        </button>
                      )}
                      {selectedTemplateId === template.id && (
                        <svg className="w-5 h-5 text-blue-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isOpening}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleOpen}
            disabled={!selectedTemplateId || isOpening}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isOpening && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isOpening ? 'Opening...' : 'Open Template'}
          </button>
        </div>
      </div>
    </>
  );
}
