'use client';

import { useEffect, useState } from 'react';
import { templateService, type TemplateMetadata } from '../../services/templateService';

interface OpenTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (projectName: string, templateName: string) => Promise<void>;
}

interface GroupedTemplates {
  [projectName: string]: TemplateMetadata[];
}

export function OpenTemplateModal({ isOpen, onClose, onOpen }: OpenTemplateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [groupedTemplates, setGroupedTemplates] = useState<GroupedTemplates>({});
  const [selectedTemplate, setSelectedTemplate] = useState<{ project: string; name: string } | null>(null);
  const [openingTemplate, setOpeningTemplate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch templates when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await templateService.listTemplates(1, 100); // Fetch up to 100 templates
      setTemplates(result.templates);

      // Group templates by project
      const grouped: GroupedTemplates = {};
      result.templates.forEach(template => {
        const projectName = template.projectName || 'default';
        if (!grouped[projectName]) {
          grouped[projectName] = [];
        }
        grouped[projectName].push(template);
      });

      // Sort templates within each project by updatedAt (newest first)
      Object.keys(grouped).forEach(projectName => {
        grouped[projectName].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });

      setGroupedTemplates(grouped);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTemplate = async () => {
    if (!selectedTemplate) return;

    setOpeningTemplate(true);
    setError(null);

    try {
      await onOpen(selectedTemplate.project, selectedTemplate.name);
      onClose();
    } catch (err) {
      console.error('Error opening template:', err);
      setError(err instanceof Error ? err.message : 'Failed to open template');
    } finally {
      setOpeningTemplate(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Filter templates based on search query
  const filteredGroupedTemplates: GroupedTemplates = {};
  Object.entries(groupedTemplates).forEach(([projectName, projectTemplates]) => {
    const filtered = projectTemplates.filter(template => {
      const searchLower = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(searchLower) ||
        projectName.toLowerCase().includes(searchLower)
      );
    });
    if (filtered.length > 0) {
      filteredGroupedTemplates[projectName] = filtered;
    }
  });

  const totalTemplates = Object.values(filteredGroupedTemplates).reduce(
    (sum, templates) => sum + templates.length,
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-3xl max-h-[80vh] rounded-lg bg-slate-900 shadow-xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">Open Template</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-slate-800">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-500 bg-opacity-10 border border-red-500 p-4">
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchTemplates}
                className="mt-2 text-sm text-blue-400 hover:text-blue-300"
              >
                Try again
              </button>
            </div>
          ) : totalTemplates === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-400 mb-2">
                {searchQuery ? 'No templates found matching your search' : 'No templates saved yet'}
              </p>
              <p className="text-slate-500 text-sm">
                {searchQuery ? 'Try a different search term' : 'Create and save your first template to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(filteredGroupedTemplates).map(([projectName, projectTemplates]) => (
                <div key={projectName}>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Project: {projectName}
                  </h3>
                  <div className="space-y-2">
                    {projectTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate({ project: projectName, name: template.name })}
                        className={`
                          relative flex items-center p-4 rounded-lg border cursor-pointer transition-all
                          ${selectedTemplate?.project === projectName && selectedTemplate?.name === template.name
                            ? 'bg-blue-600 bg-opacity-20 border-blue-500'
                            : 'bg-slate-800 border-slate-700 hover:bg-slate-750 hover:border-slate-600'
                          }
                        `}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h4 className="text-white font-medium">{template.name}</h4>
                            {template.version > 1 && (
                              <span className="text-xs text-slate-500">v{template.version}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                            <span>{template.width} × {template.height}px</span>
                            <span>{template.elementCount} element{template.elementCount !== 1 ? 's' : ''}</span>
                            <span>Updated {formatDate(template.updatedAt)}</span>
                          </div>
                        </div>
                        {selectedTemplate?.project === projectName && selectedTemplate?.name === template.name && (
                          <div className="ml-4">
                            <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-700 px-6 py-4">
          <div>
            {totalTemplates > 0 && !loading && (
              <p className="text-sm text-slate-400">
                {totalTemplates} template{totalTemplates !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenTemplate}
              disabled={!selectedTemplate || openingTemplate}
              className={`
                px-4 py-2 rounded text-sm font-medium transition-colors
                ${selectedTemplate && !openingTemplate
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {openingTemplate ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Opening...
                </span>
              ) : (
                'Open Template'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}