'use client';

import { useTemplateStore } from '../../stores/templateStore';
import type { ImageElement } from '../../types';

interface ImagePropertiesProps {
  element: ImageElement;
}

export function ImageProperties({ element }: ImagePropertiesProps) {
  const { updateElement } = useTemplateStore();

  const handleChange = (updates: Partial<ImageElement>) => {
    updateElement(element.id, updates);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Image URL</label>
        <input
          type="text"
          value={element.imageUrl}
          onChange={(e) => handleChange({ imageUrl: e.target.value })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          placeholder="Enter image URL"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Width</label>
          <input
            type="number"
            value={element.width}
            onChange={(e) => handleChange({ width: parseInt(e.target.value) || 100 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={10}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Height</label>
          <input
            type="number"
            value={element.height}
            onChange={(e) => handleChange({ height: parseInt(e.target.value) || 100 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={10}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Scale Mode</label>
        <select
          value={element.scaleMode || 'fit'}
          onChange={(e) => handleChange({ scaleMode: e.target.value as 'fill' | 'fit' | 'stretch' })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
        >
          <option value="fit">Fit</option>
          <option value="fill">Fill</option>
          <option value="stretch">Stretch</option>
        </select>
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
