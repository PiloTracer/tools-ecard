'use client';

import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { QRProperties } from './QRProperties';
import { TableProperties } from './TableProperties';
import { isTextElement, isImageElement, isQRElement, isTableElement } from '../../types';

export function PropertyPanel() {
  const { selectedElementId } = useCanvasStore();
  const { elements, removeElement } = useTemplateStore();

  const selectedElement = elements.find(el => el.id === selectedElementId);

  const handleDelete = () => {
    if (selectedElementId) {
      removeElement(selectedElementId);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-800">Properties</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedElement ? (
          <div className="text-center text-sm text-gray-500 mt-8">
            Select an element to view its properties
          </div>
        ) : (
          <div className="space-y-6">
            {/* Element Type Badge */}
            <div className="flex items-center justify-between">
              <div className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 capitalize">
                {selectedElement.type}
              </div>
              <button
                onClick={handleDelete}
                className="rounded bg-red-50 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
            </div>

            {/* Position */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Position</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">X</label>
                  <div className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {Math.round(selectedElement.x)}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Y</label>
                  <div className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {Math.round(selectedElement.y)}
                  </div>
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Rotation</h3>
              <div className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {Math.round(selectedElement.rotation || 0)}°
              </div>
            </div>

            {/* Element-specific properties */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Properties</h3>
              {isTextElement(selectedElement) && <TextProperties element={selectedElement} />}
              {isImageElement(selectedElement) && <ImageProperties element={selectedElement} />}
              {isQRElement(selectedElement) && <QRProperties element={selectedElement} />}
              {isTableElement(selectedElement) && <TableProperties element={selectedElement} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
