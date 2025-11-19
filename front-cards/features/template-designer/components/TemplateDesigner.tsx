'use client';

import React, { useState, useCallback } from 'react';
import { DesignCanvas } from './Canvas/DesignCanvas';
import { CanvasControls } from './Canvas/CanvasControls';
import { ElementToolbox } from './Toolbox/ElementToolbox';
import { PropertyPanel } from './PropertyPanel/PropertyPanel';
import { useTemplateStore } from '../stores/templateStore';
import { useCanvasStore } from '../stores/canvasStore';
import type { TemplateElement, TextElement, ImageElement, QRElement, TableElement } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TemplateDesignerProps {
  projectId: string;
}

export const TemplateDesigner: React.FC<TemplateDesignerProps> = ({ projectId }) => {
  const [selectedElement, setSelectedElement] = useState<TemplateElement | null>(null);

  const {
    template,
    elements,
    addElement,
    updateElement,
    removeElement,
    saveTemplate,
    isDirty,
    isSaving,
    createTemplate
  } = useTemplateStore();

  const {
    zoom,
    showGrid,
    snapToGrid,
    toggleGrid,
    toggleSnap,
    zoomIn,
    zoomOut,
    resetZoom
  } = useCanvasStore();

  // Initialize template if not exists
  React.useEffect(() => {
    if (!template) {
      createTemplate({
        userId: 'current-user', // TODO: Get from auth context
        projectId,
        name: 'New Template',
        type: 'vcard',
        status: 'draft',
        width: 800,
        height: 600,
        exportFormat: 'png',
        exportDpi: 300,
        brandColors: {}
      });
    }
  }, [template, projectId, createTemplate]);

  const handleAddText = useCallback(() => {
    const newElement: TextElement = {
      id: uuidv4(),
      type: 'text',
      name: 'New Text',
      x: 100,
      y: 100,
      field: '',
      content: 'Sample Text',
      fontFamily: 'Arial',
      fontSize: 16,
      color: '#000000'
    };
    addElement(newElement);
    setSelectedElement(newElement);
  }, [addElement]);

  const handleAddImage = useCallback(() => {
    const newElement: ImageElement = {
      id: uuidv4(),
      type: 'image',
      name: 'New Image',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      assetUrl: '',
      scaleMode: 'fit'
    };
    addElement(newElement);
    setSelectedElement(newElement);
  }, [addElement]);

  const handleAddQR = useCallback(() => {
    const newElement: QRElement = {
      id: uuidv4(),
      type: 'qr',
      name: 'QR Code',
      x: 100,
      y: 100,
      field: 'email',
      qrType: 'text',
      size: 150,
      margin: 4,
      colorDark: '#000000',
      colorLight: '#ffffff',
      errorCorrection: 'M'
    };
    addElement(newElement);
    setSelectedElement(newElement);
  }, [addElement]);

  const handleAddTable = useCallback(() => {
    const newElement: TableElement = {
      id: uuidv4(),
      type: 'table',
      name: 'Table',
      x: 100,
      y: 100,
      rows: 3,
      columns: 2,
      cellWidth: 100,
      cellHeight: 30,
      borderWidth: 1,
      borderColor: '#cccccc',
      autoCollapse: false,
      cells: []
    };
    addElement(newElement);
    setSelectedElement(newElement);
  }, [addElement]);

  const handleElementUpdate = useCallback((element: TemplateElement) => {
    updateElement(element);
  }, [updateElement]);

  const handleElementSelect = useCallback((fabricObject: any) => {
    if (fabricObject) {
      const elementId = (fabricObject as any).elementId;
      const element = elements.find(el => el.id === elementId);
      setSelectedElement(element || null);
    } else {
      setSelectedElement(null);
    }
  }, [elements]);

  const handleSave = async () => {
    if (!template) return;

    try {
      await saveTemplate(projectId);
      // TODO: Show success notification
      console.log('Template saved successfully');
    } catch (error) {
      console.error('Failed to save template:', error);
      // TODO: Show error notification
    }
  };

  const handleUpdateTemplateName = (name: string) => {
    useTemplateStore.getState().updateTemplate({ name });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar - Element Toolbox */}
      <ElementToolbox
        onAddText={handleAddText}
        onAddImage={handleAddImage}
        onAddQR={handleAddQR}
        onAddTable={handleAddTable}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Back to Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Template Designer</h1>
              <input
                type="text"
                placeholder="Template Name"
                className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={template?.name || ''}
                onChange={(e) => handleUpdateTemplateName(e.target.value)}
              />
              {isDirty && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  Unsaved changes
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <CanvasControls
                zoom={zoom}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onZoomReset={resetZoom}
                showGrid={showGrid}
                onToggleGrid={toggleGrid}
                snapToGrid={snapToGrid}
                onToggleSnap={toggleSnap}
              />

              <div className="w-px h-6 bg-gray-300" />

              <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className={`
                  px-4 py-2 rounded-md font-medium transition-colors
                  ${isDirty && !isSaving
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>

              <button
                className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div className="flex justify-center">
            {template && (
              <DesignCanvas
                width={template.width}
                height={template.height}
                onElementSelect={handleElementSelect}
                onElementUpdate={(fabricObj) => {
                  // Handle fabric object updates
                  const elementId = (fabricObj as any).elementId;
                  const element = elements.find(el => el.id === elementId);
                  if (element) {
                    // Update element based on fabric object changes
                    const updatedElement = {
                      ...element,
                      x: fabricObj.left || element.x,
                      y: fabricObj.top || element.y
                    };
                    handleElementUpdate(updatedElement);
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span>Canvas: {template?.width} x {template?.height}px</span>
              <span>Elements: {elements.length}</span>
              <span>Zoom: {Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Export: {template?.exportFormat?.toUpperCase()}</span>
              <span>DPI: {template?.exportDpi}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties Panel */}
      <PropertyPanel
        selectedElement={selectedElement}
        onUpdateElement={(element) => {
          handleElementUpdate(element);
          setSelectedElement(element);
        }}
      />
    </div>
  );
};