'use client';

import { useEffect } from 'react';
import { DesignCanvas } from './Canvas/DesignCanvas';
import { CanvasControls } from './Canvas/CanvasControls';
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
    <div className="flex h-screen w-full bg-gray-50">
      {/* Left Toolbox */}
      <div className="w-64 border-r border-gray-200 shadow-sm">
        <ElementToolbox />
      </div>

      {/* Center Canvas Area */}
      <div className="flex flex-1 flex-col">
        <CanvasControls />
        <DesignCanvas />
      </div>

      {/* Right Property Panel */}
      <div className="w-80 border-l border-gray-200 shadow-sm">
        <PropertyPanel />
      </div>
    </div>
  );
}
