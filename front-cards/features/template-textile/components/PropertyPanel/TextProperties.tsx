'use client';

import { useTemplateStore } from '../../stores/templateStore';
import type { TextElement } from '../../types';

interface TextPropertiesProps {
  element: TextElement;
}

export function TextProperties({ element }: TextPropertiesProps) {
  const { updateElement } = useTemplateStore();

  const handleChange = (updates: Partial<TextElement>) => {
    updateElement(element.id, updates);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Text</label>
        <textarea
          value={element.text}
          onChange={(e) => handleChange({ text: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          rows={3}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Font Size</label>
        <input
          type="number"
          value={element.fontSize}
          onChange={(e) => handleChange({ fontSize: parseInt(e.target.value) || 12 })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          min={8}
          max={200}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Font Family</label>
        <select
          value={element.fontFamily}
          onChange={(e) => handleChange({ fontFamily: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Color</label>
        <input
          type="color"
          value={element.color}
          onChange={(e) => handleChange({ color: e.target.value })}
          className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Text Align</label>
        <select
          value={element.textAlign || 'left'}
          onChange={(e) => handleChange({ textAlign: e.target.value as 'left' | 'center' | 'right' })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
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
