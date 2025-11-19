import { useState, useCallback, useEffect } from 'react';
import { resourceService } from '../services/resourceService';
import type { TemplateResource } from '../types';

export function useResources(projectId?: string) {
  const [resources, setResources] = useState<TemplateResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async (type?: TemplateResource['type']) => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await resourceService.listResources(projectId, type);
      setResources(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resources');
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const uploadResource = useCallback(async (
    file: File,
    type: TemplateResource['type']
  ): Promise<TemplateResource | null> => {
    if (!projectId) {
      setError('Project ID is required');
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      const resource = await resourceService.uploadResource(file, type, projectId);
      setResources(prev => [...prev, resource]);
      return resource;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload resource');
      return null;
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const deleteResource = useCallback(async (resourceId: string) => {
    setError(null);

    try {
      await resourceService.deleteResource(resourceId);
      setResources(prev => prev.filter(r => r.id !== resourceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete resource');
      throw err;
    }
  }, []);

  const getResourcesByType = useCallback((type: TemplateResource['type']) => {
    return resources.filter(r => r.type === type);
  }, [resources]);

  const searchResources = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return resources.filter(r =>
      r.name.toLowerCase().includes(lowercaseQuery)
    );
  }, [resources]);

  const getResourceById = useCallback((id: string) => {
    return resources.find(r => r.id === id);
  }, [resources]);

  // Auto-fetch resources when projectId changes
  useEffect(() => {
    if (projectId) {
      fetchResources();
    }
  }, [projectId, fetchResources]);

  return {
    resources,
    loading,
    uploading,
    error,
    fetchResources,
    uploadResource,
    deleteResource,
    getResourcesByType,
    searchResources,
    getResourceById
  };
}