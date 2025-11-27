'use client';

import { useTemplateStore } from '../../stores/templateStore';
import type { TextElement } from '../../types';
import { LineMetadataProperties } from './LineMetadataProperties';
import { FontSelector } from './FontSelector';

interface TextPropertiesProps {
  element: TextElement;
}

export function TextProperties({ element }: TextPropertiesProps) {
  const { updateElement } = useTemplateStore();

  const handleChange = (updates: Partial<TextElement>) => {
    updateElement(element.id, updates);
  };

  // Validate field name format (snake_case)
  const validateFieldName = (value: string): string => {
    // Remove any characters that aren't lowercase letters, numbers, or underscores
    return value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Field Name</label>
        <input
          type="text"
          value={element.fieldId || ''}
          onChange={(e) => {
            const validatedValue = validateFieldName(e.target.value);
            handleChange({ fieldId: validatedValue });
          }}
          placeholder="e.g., full_name, business_title"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional field identifier for template variables (snake_case format)
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Text</label>
        <textarea
          value={element.text}
          onChange={(e) => handleChange({ text: e.target.value })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          rows={3}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Font Size</label>
        <input
          type="number"
          value={element.fontSize}
          onChange={(e) => handleChange({ fontSize: parseInt(e.target.value) || 12 })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          min={8}
          max={200}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Font Family</label>
        <FontSelector
          value={element.fontFamily}
          onChange={(fontFamily) => handleChange({ fontFamily })}
        />
      </div>

      {/* Per-Word Color Management */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Word Colors</label>
        <div className="space-y-2">
          {/* Display current colors */}
          {element.colors && element.colors.length > 0 ? (
            <>
              {element.colors.map((color, index) => {
                const words = element.text.trim().split(/\s+/);
                const isLastColor = index === element.colors!.length - 1;
                const appliedWords = isLastColor
                  ? `Words ${index + 1}${words.length > index + 1 ? '+' : ''}`
                  : `Word ${index + 1}`;

                return (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">{appliedWords}</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newColors = [...(element.colors || [])];
                        newColors[index] = e.target.value;
                        handleChange({ colors: newColors });
                      }}
                      className="h-8 w-20 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const newColors = element.colors!.filter((_, i) => i !== index);
                        handleChange({
                          colors: newColors.length > 0 ? newColors : undefined,
                          color: newColors.length === 0 ? '#000000' : undefined
                        });
                      }}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-300"
                      disabled={element.colors!.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            /* Fallback to single color for backward compatibility */
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20">All words</span>
              <input
                type="color"
                value={element.color || '#000000'}
                onChange={(e) => handleChange({ color: e.target.value })}
                className="h-8 w-20 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Add Color button */}
          <button
            onClick={() => {
              const currentColors = element.colors || (element.color ? [element.color] : ['#000000']);
              const lastColor = currentColors[currentColors.length - 1];
              handleChange({
                colors: [...currentColors, lastColor],
                color: undefined // Clear old single color property
              });
            }}
            className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-300"
          >
            + Add Color
          </button>

          {/* Preview hint */}
          {element.colors && element.colors.length > 0 && (
            <div className="p-2 bg-gray-50 rounded text-xs text-gray-600">
              <div className="font-semibold mb-1">Preview:</div>
              <div className="flex flex-wrap gap-1">
                {element.text.trim().split(/\s+/).map((word, index) => {
                  const colorIndex = Math.min(index, (element.colors?.length || 1) - 1);
                  const color = element.colors?.[colorIndex] || element.color || '#000000';
                  return (
                    <span key={index} style={{ color }}>
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Text Align</label>
        <select
          value={element.textAlign || 'left'}
          onChange={(e) => handleChange({ textAlign: e.target.value as 'left' | 'center' | 'right' })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleChange({ fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
          className={`rounded border px-3 py-2 text-sm font-bold transition-colors ${
            element.fontWeight === 'bold'
              ? 'border-blue-500 bg-blue-100 text-blue-800'
              : 'border-gray-300 bg-white text-slate-800 hover:bg-gray-50'
          }`}
        >
          B
        </button>
        <button
          onClick={() => handleChange({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`rounded border px-3 py-2 text-sm italic font-medium transition-colors ${
            element.fontStyle === 'italic'
              ? 'border-blue-500 bg-blue-100 text-blue-800'
              : 'border-gray-300 bg-white text-slate-800 hover:bg-gray-50'
          }`}
        >
          I
        </button>
        <button
          onClick={() => handleChange({ underline: !element.underline })}
          className={`rounded border px-3 py-2 text-sm underline font-medium transition-colors ${
            element.underline
              ? 'border-blue-500 bg-blue-100 text-blue-800'
              : 'border-gray-300 bg-white text-slate-800 hover:bg-gray-50'
          }`}
        >
          U
        </button>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Stroke Color</label>
        <input
          type="color"
          value={element.stroke || '#000000'}
          onChange={(e) => handleChange({ stroke: e.target.value })}
          className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Stroke Width</label>
        <input
          type="number"
          value={element.strokeWidth || 0}
          onChange={(e) => handleChange({ strokeWidth: parseInt(e.target.value) || 0 })}
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

      {/* Line Metadata Section */}
      <LineMetadataProperties element={element} />
    </div>
  );
}
