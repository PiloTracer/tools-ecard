'use client';

import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { QRProperties } from './QRProperties';
import { TableProperties } from './TableProperties';
import { ShapeProperties } from './ShapeProperties';
import { isTextElement, isImageElement, isQRElement, isTableElement, isShapeElement } from '../../types';
import type { TableElement } from '../../types';

export function PropertyPanel() {
  const { selectedElementId, width: canvasWidth, height: canvasHeight, fabricCanvas } = useCanvasStore();
  const { elements, removeElement, updateElement, duplicateElement, bringToFront, sendToBack, bringForward, sendBackward } = useTemplateStore();

  const selectedElement = elements.find(el => el.id === selectedElementId);

  // Check if selected element is in a table cell
  const cellInfo = selectedElement && selectedElement.type !== 'table' ? (() => {
    const tables = elements.filter(el => el.type === 'table') as TableElement[];
    for (const table of tables) {
      const cellData = table.cells.find(c => c.elementId === selectedElement.id);
      if (cellData) {
        return { table, cellData };
      }
    }
    return null;
  })() : null;

  const handleDelete = () => {
    if (selectedElementId) {
      // Remove element from any table cells
      const tables = elements.filter(el => el.type === 'table') as TableElement[];
      tables.forEach(table => {
        const wasInCell = table.cells.some(c => c.elementId === selectedElementId);
        if (wasInCell) {
          const newCells = table.cells.filter(c => c.elementId !== selectedElementId);
          updateElement(table.id, { cells: newCells });
        }
      });

      removeElement(selectedElementId);
    }
  };

  const handleDuplicate = () => {
    if (selectedElementId) {
      duplicateElement(selectedElementId);
    }
  };

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'canvas-center') => {
    if (!selectedElementId || !fabricCanvas || !selectedElement) return;

    const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
    if (!fabricObj) return;

    const objWidth = (fabricObj.width || 0) * (fabricObj.scaleX || 1);
    const objHeight = (fabricObj.height || 0) * (fabricObj.scaleY || 1);

    let newX = selectedElement.x;
    let newY = selectedElement.y;

    switch (type) {
      case 'left':
        newX = 0;
        break;
      case 'center':
        newX = (canvasWidth - objWidth) / 2;
        break;
      case 'right':
        newX = canvasWidth - objWidth;
        break;
      case 'top':
        newY = 0;
        break;
      case 'middle':
        newY = (canvasHeight - objHeight) / 2;
        break;
      case 'bottom':
        newY = canvasHeight - objHeight;
        break;
      case 'canvas-center':
        newX = (canvasWidth - objWidth) / 2;
        newY = (canvasHeight - objHeight) / 2;
        break;
    }

    updateElement(selectedElementId, { x: newX, y: newY });
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 bg-gradient-to-r from-white to-slate-50 p-4">
        <h2 className="text-lg font-bold text-slate-800">Properties</h2>
        <p className="text-xs text-slate-500 mt-0.5">Element settings</p>
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
              <div className="flex gap-2">
                <button
                  onClick={handleDuplicate}
                  className="rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-100"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded bg-red-50 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Position */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Position {cellInfo && <span className="text-xs font-normal text-gray-500">(relative to cell)</span>}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">X</label>
                  <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium">
                    {cellInfo ? Math.round(cellInfo.cellData.offsetX ?? 5) : Math.round(selectedElement.x)}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Y</label>
                  <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium">
                    {cellInfo ? Math.round(cellInfo.cellData.offsetY ?? 5) : Math.round(selectedElement.y)}
                  </div>
                </div>
              </div>
              {cellInfo && (
                <div className="mt-2 text-xs text-gray-500">
                  In table cell [{cellInfo.cellData.row}, {cellInfo.cellData.column}]
                </div>
              )}
            </div>

            {/* Rotation */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Rotation</h3>
              <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium">
                {Math.round(selectedElement.rotation || 0)}°
              </div>
            </div>

            {/* Layering */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Layering</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => bringToFront(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  To Front
                </button>
                <button
                  onClick={() => sendToBack(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  To Back
                </button>
                <button
                  onClick={() => bringForward(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  Forward
                </button>
                <button
                  onClick={() => sendBackward(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  Backward
                </button>
              </div>
            </div>

            {/* Alignment */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Align</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAlign('left')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Left
                  </button>
                  <button
                    onClick={() => handleAlign('center')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Center
                  </button>
                  <button
                    onClick={() => handleAlign('right')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Right
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAlign('top')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Top
                  </button>
                  <button
                    onClick={() => handleAlign('middle')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Middle
                  </button>
                  <button
                    onClick={() => handleAlign('bottom')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Bottom
                  </button>
                </div>
                <button
                  onClick={() => handleAlign('canvas-center')}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                >
                  Canvas Center
                </button>
              </div>
            </div>

            {/* Element-specific properties */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Properties</h3>
              {isTextElement(selectedElement) && <TextProperties element={selectedElement} />}
              {isImageElement(selectedElement) && <ImageProperties element={selectedElement} />}
              {isQRElement(selectedElement) && <QRProperties element={selectedElement} />}
              {isTableElement(selectedElement) && <TableProperties element={selectedElement} />}
              {isShapeElement(selectedElement) && <ShapeProperties element={selectedElement} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
