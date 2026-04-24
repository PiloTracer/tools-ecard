'use client';

import { useTemplateStore } from '../../stores/templateStore';
import type { ShapeElement } from '../../types';
import { NumericStringInput } from '../common/NumericStringInput';

interface ShapePropertiesProps {
  element: ShapeElement;
}

export function ShapeProperties({ element }: ShapePropertiesProps) {
  const { updateElement } = useTemplateStore();

  const handleChange = (updates: Partial<ShapeElement>) => {
    updateElement(element.id, updates);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Width</label>
          <NumericStringInput
            value={isNaN(element.width) ? 100 : element.width}
            roundDisplay
            resetKey={element.id}
            min={10}
            onCommit={(n) => handleChange({ width: n })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>
        {element.shapeType !== 'line' && element.shapeType !== 'circle' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Height</label>
            <NumericStringInput
              value={isNaN(element.height) ? 100 : element.height}
              roundDisplay
              resetKey={element.id}
              min={10}
              onCommit={(n) => handleChange({ height: n })}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {element.shapeType !== 'line' && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fill Color</label>
          <input
            type="color"
            value={element.fill || '#3b82f6'}
            onChange={(e) => handleChange({ fill: e.target.value })}
            className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Stroke Color</label>
        <input
          type="color"
          value={element.stroke || '#1e40af'}
          onChange={(e) => handleChange({ stroke: e.target.value })}
          className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Stroke Width</label>
        <NumericStringInput
          value={isNaN(element.strokeWidth ?? 1) ? 1 : (element.strokeWidth ?? 1)}
          roundDisplay
          resetKey={element.id}
          min={0}
          max={20}
          onCommit={(n) => handleChange({ strokeWidth: n })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
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
