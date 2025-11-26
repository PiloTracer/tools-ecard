'use client';

import { useState, useEffect } from 'react';
import { templateService, type TemplateMetadata } from '../../services/templateService';
import { OffscreenExportButton } from '../OffscreenExport/OffscreenExportButton';

interface OpenTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (templateId: string) => Promise<void>;
}

export function OpenTemplateModal({
  isOpen,
  onClose,
  onOpen
}: OpenTemplateModalProps) {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
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
      const templateList = await templateService.listTemplates();
      setTemplates(templateList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

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
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-sm text-gray-600">No templates found</p>
              <p className="mt-1 text-xs text-gray-500">Create a template first to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
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
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-medium text-gray-900 truncate">
                          {template.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Updated: {new Date(template.updatedAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Mode: {template.storageMode}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            v{template.version}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <OffscreenExportButton
                            templateId={template.id}
                            templateName={template.name}
                          />
                        </div>
                        {selectedTemplateId === template.id && (
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
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
