'use client';

import { ProtectedRoute } from '@/features/auth';
import { ProjectsProvider } from '@/features/simple-projects';
import { TemplateDesigner } from '@/features/template-textile';

export default function TemplateTextilePage() {
  return (
    <ProtectedRoute>
      <ProjectsProvider>
        <TemplateDesigner />
      </ProjectsProvider>
    </ProtectedRoute>
  );
}
