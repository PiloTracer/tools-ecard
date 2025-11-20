'use client';

import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { QRProperties } from './QRProperties';
import { TableProperties } from './TableProperties';
import { isTextElement, isImageElement, isQRElement, isTableElement } from '../../types';
import type { TableElement } from '../../types';

export function PropertyPanel() {
  const { selectedElementId } = useCanvasStore();
  const { elements, removeElement, updateElement } = useTemplateStore();

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
              <button
                onClick={handleDelete}
                className="rounded bg-red-50 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
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
