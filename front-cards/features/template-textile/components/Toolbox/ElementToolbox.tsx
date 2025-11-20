'use client';

import { useTemplateStore } from '../../stores/templateStore';
import { useCanvasStore } from '../../stores/canvasStore';
import type { TextElement, ImageElement, QRElement, TableElement, ShapeElement } from '../../types';

export function ElementToolbox() {
  const { addElement } = useTemplateStore();
  const { width, height } = useCanvasStore();


  const handleAddText = () => {
    const textElement: TextElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: width / 2 - 50,
      y: height / 2 - 20,
      text: 'Text',
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#000000',
      textAlign: 'left',
      rotation: 0,
      opacity: 1,
      locked: false,
    };
    addElement(textElement);
  };

  const handleAddImage = () => {
    const imageElement: ImageElement = {
      id: crypto.randomUUID(),
      type: 'image',
      x: width / 2 - 75,
      y: height / 2 - 75,
      width: 150,
      height: 150,
      imageUrl: '',
      scaleMode: 'fit',
      rotation: 0,
      opacity: 1,
      locked: false,
    };
    addElement(imageElement);
  };

  const handleAddQR = () => {
    const qrElement: QRElement = {
      id: crypto.randomUUID(),
      type: 'qr',
      x: width / 2 - 50,
      y: height / 2 - 50,
      size: 100,
      data: 'https://example.com',
      qrType: 'url',
      colorDark: '#000000',
      colorLight: '#ffffff',
      rotation: 0,
      opacity: 1,
      locked: false,
    };
    addElement(qrElement);
  };

  const handleAddTable = () => {
    const defaultColWidth = 60;
    const defaultRowHeight = 50;
    const cols = 3;
    const rows = 3;

    const tableElement: TableElement = {
      id: crypto.randomUUID(),
      type: 'table',
      x: width / 2 - (cols * defaultColWidth) / 2,
      y: height / 2 - (rows * defaultRowHeight) / 2,
      rows,
      columns: cols,
      columnWidths: Array(cols).fill(defaultColWidth),
      rowHeights: Array(rows).fill(defaultRowHeight),
      minCellWidth: 60,
      minCellHeight: 50,
      borderColor: '#cccccc',
      borderWidth: 1,
      cells: [],
      rotation: 0,
      opacity: 1,
      locked: false,
    };
    addElement(tableElement);
  };

  const handleAddShape = (shapeType: 'rectangle' | 'circle' | 'ellipse' | 'line') => {
    const shapeElement: ShapeElement = {
      id: crypto.randomUUID(),
      type: 'shape',
      shapeType,
      x: width / 2 - 50,
      y: height / 2 - 50,
      width: 100,
      height: shapeType === 'line' ? 0 : 100,
      fill: shapeType === 'line' ? '' : '#3b82f6',
      stroke: '#1e40af',
      strokeWidth: shapeType === 'line' ? 2 : 1,
      rotation: 0,
      opacity: 1,
      locked: false,
    };
    addElement(shapeElement);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white p-4">
        <h2 className="text-lg font-bold text-slate-800">Elements</h2>
        <p className="text-xs text-slate-500 mt-0.5">Drag to canvas</p>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <button
          onClick={handleAddText}
          className="flex items-center gap-3 rounded-lg border-2 border-slate-200 p-3 text-left hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 shadow-sm">
            <span className="text-2xl font-bold text-purple-700">T</span>
          </div>
          <div>
            <div className="font-semibold text-slate-800">Text</div>
            <div className="text-xs text-slate-500">Add text element</div>
          </div>
        </button>

        <button
          onClick={handleAddImage}
          className="flex items-center gap-3 rounded-lg border-2 border-slate-200 p-3 text-left hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-green-100 to-green-200 shadow-sm">
            <svg className="h-6 w-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-800">Image</div>
            <div className="text-xs text-slate-500">Add image element</div>
          </div>
        </button>

        <button
          onClick={handleAddQR}
          className="flex items-center gap-3 rounded-lg border-2 border-slate-200 p-3 text-left hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 shadow-sm">
            <svg className="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-800">QR Code</div>
            <div className="text-xs text-slate-500">Add QR code element</div>
          </div>
        </button>

        <button
          onClick={handleAddTable}
          className="flex items-center gap-3 rounded-lg border-2 border-slate-200 p-3 text-left hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-cyan-200 shadow-sm">
            <svg className="h-6 w-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-800">Table</div>
            <div className="text-xs text-slate-500">Add table element</div>
          </div>
        </button>

        <div className="border-t border-slate-200 pt-3 mt-3">
          <div className="text-xs font-semibold text-slate-600 mb-2 px-1">SHAPES</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAddShape('rectangle')}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-slate-200 p-2 hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-indigo-100 to-indigo-200">
                <div className="w-5 h-4 border-2 border-indigo-700"></div>
              </div>
              <div className="text-xs font-medium text-slate-800">Rectangle</div>
            </button>

            <button
              onClick={() => handleAddShape('circle')}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-slate-200 p-2 hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-pink-100 to-pink-200">
                <div className="w-5 h-5 rounded-full border-2 border-pink-700"></div>
              </div>
              <div className="text-xs font-medium text-slate-800">Circle</div>
            </button>

            <button
              onClick={() => handleAddShape('ellipse')}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-slate-200 p-2 hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-violet-100 to-violet-200">
                <div className="w-6 h-4 rounded-full border-2 border-violet-700"></div>
              </div>
              <div className="text-xs font-medium text-slate-800">Ellipse</div>
            </button>

            <button
              onClick={() => handleAddShape('line')}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-slate-200 p-2 hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-slate-100 to-slate-200">
                <div className="w-6 h-0 border-t-2 border-slate-700"></div>
              </div>
              <div className="text-xs font-medium text-slate-800">Line</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
