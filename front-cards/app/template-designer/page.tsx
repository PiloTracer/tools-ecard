'use client';

import { ProtectedRoute } from '@/features/auth';
import { TemplateDesigner } from '@/features/template-designer';
import { useProjects } from '@/features/simple-projects';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function TemplateDesignerContent() {
  const { selectedProjectId, loading } = useProjects();
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard if no project is selected
    if (!loading && !selectedProjectId) {
      router.push('/dashboard');
    }
  }, [selectedProjectId, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!selectedProjectId) {
    return null;
  }

  return <TemplateDesigner projectId={selectedProjectId} />;
}

export default function TemplateDesignerPage() {
  return (
    <ProtectedRoute>
      <TemplateDesignerContent />
    </ProtectedRoute>
  );
}