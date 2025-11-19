import { useState, useEffect, useCallback } from 'react';
import { templateService } from '../services/templateService';
import type { Template } from '../types';

export function useTemplates(projectId?: string) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await templateService.listTemplates(projectId);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createTemplate = useCallback(async (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    setError(null);

    try {
      const newTemplate = await templateService.createTemplate({
        ...template,
        projectId
      });
      setTemplates(prev => [...prev, newTemplate]);
      return newTemplate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create template';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [projectId]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<Template>) => {
    setError(null);

    try {
      const updatedTemplate = await templateService.updateTemplate(id, updates);
      setTemplates(prev =>
        prev.map(t => t.id === id ? updatedTemplate : t)
      );
      return updatedTemplate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    setError(null);

    try {
      await templateService.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const duplicateTemplate = useCallback(async (id: string, newName: string) => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    setError(null);

    try {
      const duplicated = await templateService.duplicateTemplate(id, newName, projectId);
      setTemplates(prev => [...prev, duplicated]);
      return duplicated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate template';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate
  };
}