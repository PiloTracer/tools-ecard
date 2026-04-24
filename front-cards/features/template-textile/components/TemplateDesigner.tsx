'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DesignCanvas } from './Canvas/DesignCanvas';
import { CanvasControls } from './Canvas/CanvasControls';
import { CanvasSettings } from './CanvasSettings';
import { ElementToolbox } from './Toolbox/ElementToolbox';
import { PropertyPanel } from './PropertyPanel/PropertyPanel';
import { useTemplateStore } from '../stores/templateStore';
import { useCanvasStore } from '../stores/canvasStore';

export function TemplateDesigner() {
  const router = useRouter();
  const { currentTemplate, createTemplate, hasUnsavedChanges } = useTemplateStore();
  const { setDimensions } = useCanvasStore();

  const goToDashboard = () => {
    if (hasUnsavedChanges) {
      const ok = window.confirm('You have unsaved changes. Leave the designer anyway?');
      if (!ok) {
        return;
      }
    }
    router.push('/dashboard');
  };

  // Initialize with a default template if none exists
  useEffect(() => {
    if (!currentTemplate) {
      createTemplate('Untitled Template', 800, 600);
      setDimensions(800, 600);
    }
  }, [currentTemplate, createTemplate, setDimensions]);

  const dashboardButton = (
    <button
      type="button"
      onClick={goToDashboard}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-slate-600/80 bg-slate-700/80 px-2 py-1 text-left text-slate-200 transition hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-2.5 sm:py-1.5"
      aria-label="Back to dashboard"
    >
      <svg className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="whitespace-nowrap text-xs font-medium sm:text-sm">Dashboard</span>
    </button>
  );

  const appTitle = (
    <p className="min-w-0 select-none truncate text-xs text-slate-400 sm:text-sm">
      <span className="text-slate-200">E-Cards Designer</span>
      <span className="text-slate-500"> | Tools</span>
    </p>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-slate-600">
      <div className="flex min-h-0 flex-1 w-full">
        {/* Left Toolbox */}
        <div className="w-64 flex-shrink-0 border-r border-slate-700 shadow-lg bg-white">
          <ElementToolbox />
        </div>

        {/* Center Canvas Area */}
        <div className="flex flex-1 flex-col bg-slate-700 min-w-0">
          <CanvasSettings leadingContent={dashboardButton} titleContent={appTitle} />
          <CanvasControls />
          <DesignCanvas />
        </div>

        {/* Right Property Panel */}
        <div className="w-80 flex-shrink-0 border-l border-slate-700 shadow-lg bg-white">
          <PropertyPanel />
        </div>
      </div>
    </div>
  );
}
