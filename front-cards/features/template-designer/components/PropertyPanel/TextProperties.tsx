'use client';

import React, { useState } from 'react';
import type { TextElement } from '../../types';

interface TextPropertiesProps {
  element: TextElement;
  onUpdate: (element: TextElement) => void;
}

export const TextProperties: React.FC<TextPropertiesProps> = ({
  element,
  onUpdate
}) => {
  const [showStyleRules, setShowStyleRules] = useState(false);

  const fonts = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Trebuchet MS',
    'Palatino',
    'Garamond',
    'Comic Sans MS'
  ];

  const fieldOptions = [
    { value: '', label: 'Static Text' },
    { value: 'fullName', label: 'Full Name' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'position', label: 'Position' },
    { value: 'department', label: 'Department' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'extension', label: 'Extension' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'website', label: 'Website' },
    { value: 'custom', label: 'Custom Field' }
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Text Properties
      </h4>

      {/* Field Mapping */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Data Field
        </label>
        <select
          value={element.field}
          onChange={(e) => onUpdate({ ...element, field: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
        >
          {fieldOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Static Content (if no field selected) */}
      {!element.field && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Text Content
          </label>
          <textarea
            value={element.content || ''}
            onChange={(e) => onUpdate({ ...element, content: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Enter text..."
          />
        </div>
      )}

      {/* Font Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Font Family
          </label>
          <select
            value={element.fontFamily}
            onChange={(e) => onUpdate({ ...element, fontFamily: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          >
            {fonts.map(font => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Font Size
          </label>
          <input
            type="number"
            value={element.fontSize}
            onChange={(e) =>
              onUpdate({ ...element, fontSize: parseInt(e.target.value) || 12 })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            min="6"
            max="200"
          />
        </div>
      </div>

      {/* Color and Style */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Color
          </label>
          <div className="flex gap-1">
            <input
              type="color"
              value={element.color}
              onChange={(e) => onUpdate({ ...element, color: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={element.color}
              onChange={(e) => onUpdate({ ...element, color: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="#000000"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Text Align
          </label>
          <select
            value={element.textAlign || 'left'}
            onChange={(e) =>
              onUpdate({
                ...element,
                textAlign: e.target.value as 'left' | 'center' | 'right'
              })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      {/* Font Weight and Style */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Font Weight
          </label>
          <select
            value={element.fontWeight || 400}
            onChange={(e) =>
              onUpdate({ ...element, fontWeight: parseInt(e.target.value) })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="100">Thin</option>
            <option value="300">Light</option>
            <option value="400">Normal</option>
            <option value="500">Medium</option>
            <option value="600">Semibold</option>
            <option value="700">Bold</option>
            <option value="900">Black</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Font Style
          </label>
          <select
            value={element.fontStyle || 'normal'}
            onChange={(e) =>
              onUpdate({
                ...element,
                fontStyle: e.target.value as 'normal' | 'italic'
              })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
        </div>
      </div>

      {/* Auto-fit Settings */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center mb-3">
          <input
            type="checkbox"
            id="autoFit"
            checked={element.autoFit?.enabled || false}
            onChange={(e) =>
              onUpdate({
                ...element,
                autoFit: {
                  ...element.autoFit,
                  enabled: e.target.checked,
                  minSize: element.autoFit?.minSize || 8,
                  maxSize: element.autoFit?.maxSize || element.fontSize
                }
              })
            }
            className="mr-2"
          />
          <label htmlFor="autoFit" className="text-xs font-medium text-gray-700">
            Auto-fit text to container
          </label>
        </div>

        {element.autoFit?.enabled && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Min Size
              </label>
              <input
                type="number"
                value={element.autoFit.minSize}
                onChange={(e) =>
                  onUpdate({
                    ...element,
                    autoFit: {
                      ...element.autoFit!,
                      minSize: parseInt(e.target.value) || 8
                    }
                  })
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                min="4"
                max="100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Max Size
              </label>
              <input
                type="number"
                value={element.autoFit.maxSize}
                onChange={(e) =>
                  onUpdate({
                    ...element,
                    autoFit: {
                      ...element.autoFit!,
                      maxSize: parseInt(e.target.value) || element.fontSize
                    }
                  })
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                min="4"
                max="200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Style Rules */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowStyleRules(!showStyleRules)}
          className="flex items-center justify-between w-full text-xs font-medium text-gray-700"
        >
          <span>Style Rules</span>
          <svg
            className={`w-4 h-4 transition-transform ${
              showStyleRules ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showStyleRules && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-500">
              Apply different styles to specific words
            </p>
            <button className="w-full px-3 py-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition-colors">
              Add Style Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
};