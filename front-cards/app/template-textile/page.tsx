'use client';

import { ProtectedRoute } from '@/features/auth';
import { useAuth } from '@/features/auth';
import { ProjectsProvider } from '@/features/simple-projects';
import { TemplateDesigner } from '@/features/template-textile';

function TemplateTextileWithProjects() {
  const { user } = useAuth();
  return (
    <ProjectsProvider sessionUserId={user?.id}>
      <TemplateDesigner />
    </ProjectsProvider>
  );
}

export default function TemplateTextilePage() {
  return (
    <ProtectedRoute>
      <TemplateTextileWithProjects />
    </ProtectedRoute>
  );
}
