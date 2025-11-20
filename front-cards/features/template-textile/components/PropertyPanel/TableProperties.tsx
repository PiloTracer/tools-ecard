'use client';

import { useTemplateStore } from '../../stores/templateStore';
import type { TableElement } from '../../types';

interface TablePropertiesProps {
  element: TableElement;
}

export function TableProperties({ element }: TablePropertiesProps) {
  const { updateElement } = useTemplateStore();

  const handleChange = (updates: Partial<TableElement>) => {
    updateElement(element.id, updates);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Rows</label>
          <input
            type="number"
            value={element.rows}
            onChange={(e) => handleChange({ rows: parseInt(e.target.value) || 1 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={1}
            max={20}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Columns</label>
          <input
            type="number"
            value={element.columns}
            onChange={(e) => handleChange({ columns: parseInt(e.target.value) || 1 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={1}
            max={20}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cell Width</label>
          <input
            type="number"
            value={element.cellWidth}
            onChange={(e) => handleChange({ cellWidth: parseInt(e.target.value) || 50 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={20}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cell Height</label>
          <input
            type="number"
            value={element.cellHeight}
            onChange={(e) => handleChange({ cellHeight: parseInt(e.target.value) || 50 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={20}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Border Color</label>
        <input
          type="color"
          value={element.borderColor || '#cccccc'}
          onChange={(e) => handleChange({ borderColor: e.target.value })}
          className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Border Width</label>
        <input
          type="number"
          value={element.borderWidth || 1}
          onChange={(e) => handleChange({ borderWidth: parseInt(e.target.value) || 1 })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          min={0}
          max={10}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Opacity</label>
        <input
          type="range"
          value={(element.opacity || 1) * 100}
          onChange={(e) => handleChange({ opacity: parseInt(e.target.value) / 100 })}
          className="w-full"
          min={0}
          max={100}
        />
        <div className="text-xs text-gray-500 text-right">{Math.round((element.opacity || 1) * 100)}%</div>
      </div>
    </div>
  );
}
