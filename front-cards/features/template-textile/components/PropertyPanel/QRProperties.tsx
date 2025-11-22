'use client';

import { useTemplateStore } from '../../stores/templateStore';
import type { QRElement } from '../../types';

interface QRPropertiesProps {
  element: QRElement;
}

export function QRProperties({ element }: QRPropertiesProps) {
  const { updateElement } = useTemplateStore();

  const handleChange = (updates: Partial<QRElement>) => {
    updateElement(element.id, updates);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">QR Type</label>
        <select
          value={element.qrType}
          onChange={(e) => handleChange({ qrType: e.target.value as 'url' | 'text' | 'vcard' })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
        >
          <option value="url">URL</option>
          <option value="text">Text</option>
          <option value="vcard">vCard</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Data</label>
        <textarea
          value={element.data}
          onChange={(e) => handleChange({ data: e.target.value })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          rows={3}
          placeholder={element.qrType === 'url' ? 'https://example.com' : 'Enter data'}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Size</label>
        <input
          type="number"
          value={element.size}
          onChange={(e) => {
            const newSize = parseInt(e.target.value) || 100;
            handleChange({ size: newSize, width: newSize, height: newSize, originalWidth: newSize, originalHeight: newSize });
          }}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          min={50}
          max={500}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Dark Color</label>
        <input
          type="color"
          value={element.colorDark || '#000000'}
          onChange={(e) => handleChange({ colorDark: e.target.value })}
          className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Light Color</label>
        <input
          type="color"
          value={element.colorLight || '#ffffff'}
          onChange={(e) => handleChange({ colorLight: e.target.value })}
          className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
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
