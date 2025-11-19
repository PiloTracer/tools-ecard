'use client';

import React from 'react';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { QRProperties } from './QRProperties';
import { TableProperties } from './TableProperties';
import type {
  TemplateElement,
  TextElement,
  ImageElement,
  QRElement,
  TableElement
} from '../../types';
import {
  isTextElement,
  isImageElement,
  isQRElement,
  isTableElement
} from '../../types';

interface PropertyPanelProps {
  selectedElement: TemplateElement | null;
  onUpdateElement: (element: TemplateElement) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElement,
  onUpdateElement
}) => {
  console.log('PropertyPanel render - selectedElement:', selectedElement);

  if (!selectedElement) {
    return (
      <div className="w-80 h-full bg-white border-l border-gray-200 overflow-y-auto">
        <div className="p-6">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-gray-500">
              Select an element to edit properties
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getElementTypeName = (type: string) => {
    switch (type) {
      case 'text':
        return 'Text';
      case 'image':
        return 'Image';
      case 'qr':
        return 'QR Code';
      case 'table':
        return 'Table';
      default:
        return 'Element';
    }
  };

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Properties</h3>
        <p className="text-sm text-gray-500 mt-1">
          {getElementTypeName(selectedElement.type)} Element
        </p>
        {selectedElement.name && (
          <p className="text-xs text-gray-400 mt-1 truncate">
            {selectedElement.name}
          </p>
        )}
      </div>

      <div className="p-4">
        {/* Common properties */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Position & Size
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                X
              </label>
              <input
                type="number"
                value={selectedElement.x}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    x: parseInt(e.target.value) || 0
                  })
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Y
              </label>
              <input
                type="number"
                value={selectedElement.y}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    y: parseInt(e.target.value) || 0
                  })
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {selectedElement.width !== undefined && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Width
                </label>
                <input
                  type="number"
                  value={selectedElement.width}
                  onChange={(e) =>
                    onUpdateElement({
                      ...selectedElement,
                      width: parseInt(e.target.value) || 100
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            {selectedElement.height !== undefined && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Height
                </label>
                <input
                  type="number"
                  value={selectedElement.height}
                  onChange={(e) =>
                    onUpdateElement({
                      ...selectedElement,
                      height: parseInt(e.target.value) || 100
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Appearance */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Appearance
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rotation
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={selectedElement.rotation || 0}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    rotation: parseInt(e.target.value)
                  })
                }
                className="w-full"
              />
              <div className="text-xs text-gray-500 text-center">
                {selectedElement.rotation || 0}°
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Opacity
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={(selectedElement.opacity || 1) * 100}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    opacity: parseInt(e.target.value) / 100
                  })
                }
                className="w-full"
              />
              <div className="text-xs text-gray-500 text-center">
                {Math.round((selectedElement.opacity || 1) * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Type-specific properties */}
        <div className="border-t border-gray-200 pt-4">
          {isTextElement(selectedElement) && (
            <TextProperties
              element={selectedElement}
              onUpdate={onUpdateElement}
            />
          )}
          {isImageElement(selectedElement) && (
            <ImageProperties
              element={selectedElement}
              onUpdate={onUpdateElement}
            />
          )}
          {isQRElement(selectedElement) && (
            <QRProperties
              element={selectedElement}
              onUpdate={onUpdateElement}
            />
          )}
          {isTableElement(selectedElement) && (
            <TableProperties
              element={selectedElement}
              onUpdate={onUpdateElement}
            />
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              onClick={() => {
                // TODO: Duplicate element
              }}
            >
              Duplicate
            </button>
            <button
              className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
              onClick={() => {
                // TODO: Delete element
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};