'use client';

import { useEffect } from 'react';
import { DesignCanvas } from './Canvas/DesignCanvas';
import { CanvasControls } from './Canvas/CanvasControls';
import { CanvasSettings } from './CanvasSettings';
import { ElementToolbox } from './Toolbox/ElementToolbox';
import { PropertyPanel } from './PropertyPanel/PropertyPanel';
import { useTemplateStore } from '../stores/templateStore';
import { useCanvasStore } from '../stores/canvasStore';

export function TemplateDesigner() {
  const { currentTemplate, createTemplate } = useTemplateStore();
  const { setDimensions } = useCanvasStore();

  // Initialize with a default template if none exists
  useEffect(() => {
    if (!currentTemplate) {
      createTemplate('Untitled Template', 800, 600);
      setDimensions(800, 600);
    }
  }, [currentTemplate, createTemplate, setDimensions]);

  return (
    <div className="flex h-screen w-full bg-slate-600">
      {/* Left Toolbox */}
      <div className="w-64 flex-shrink-0 border-r border-slate-700 shadow-lg bg-white">
        <ElementToolbox />
      </div>

      {/* Center Canvas Area */}
      <div className="flex flex-1 flex-col bg-slate-700 min-w-0">
        <CanvasSettings />
        <CanvasControls />
        <DesignCanvas />
      </div>

      {/* Right Property Panel */}
      <div className="w-80 flex-shrink-0 border-l border-slate-700 shadow-lg bg-white">
        <PropertyPanel />
      </div>
    </div>
  );
}
