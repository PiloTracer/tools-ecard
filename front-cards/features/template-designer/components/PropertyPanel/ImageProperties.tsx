'use client';

import React from 'react';
import type { ImageElement } from '../../types';

interface ImagePropertiesProps {
  element: ImageElement;
  onUpdate: (element: ImageElement) => void;
}

export const ImageProperties: React.FC<ImagePropertiesProps> = ({
  element,
  onUpdate
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Image Properties
      </h4>

      {/* Image Source */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Image Source
        </label>
        <div className="space-y-2">
          <button className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition-colors">
            Select from Library
          </button>
          <button className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">
            Upload New Image
          </button>
        </div>
        {element.assetUrl && (
          <div className="mt-2 p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500 truncate">{element.assetUrl}</p>
          </div>
        )}
      </div>

      {/* Scale Mode */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Scale Mode
        </label>
        <select
          value={element.scaleMode || 'fit'}
          onChange={(e) =>
            onUpdate({
              ...element,
              scaleMode: e.target.value as 'fill' | 'fit' | 'stretch'
            })
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="fill">Fill (Crop)</option>
          <option value="fit">Fit (Contain)</option>
          <option value="stretch">Stretch</option>
        </select>
      </div>

      {/* Dynamic Visibility */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Visibility Field
        </label>
        <select
          value={element.visibilityField || ''}
          onChange={(e) =>
            onUpdate({ ...element, visibilityField: e.target.value || undefined })
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Always Visible</option>
          <option value="phoneShow">Show if Phone Present</option>
          <option value="whatsappShow">Show if WhatsApp Present</option>
          <option value="emailShow">Show if Email Present</option>
          <option value="websiteShow">Show if Website Present</option>
        </select>
      </div>

      {/* Dynamic Position */}
      <div className="border-t border-gray-200 pt-4">
        <h5 className="text-xs font-medium text-gray-700 mb-2">
          Dynamic Position (Advanced)
        </h5>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              X Position Field
            </label>
            <input
              type="text"
              value={element.dynamicPosition?.xField || ''}
              onChange={(e) =>
                onUpdate({
                  ...element,
                  dynamicPosition: {
                    ...element.dynamicPosition,
                    xField: e.target.value || undefined
                  }
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., iconX"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Y Position Field
            </label>
            <input
              type="text"
              value={element.dynamicPosition?.yField || ''}
              onChange={(e) =>
                onUpdate({
                  ...element,
                  dynamicPosition: {
                    ...element.dynamicPosition,
                    yField: e.target.value || undefined
                  }
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., iconY"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Formula
            </label>
            <input
              type="text"
              value={element.dynamicPosition?.formula || ''}
              onChange={(e) =>
                onUpdate({
                  ...element,
                  dynamicPosition: {
                    ...element.dynamicPosition,
                    formula: e.target.value || undefined
                  }
                })
              }
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., max(text1.right, text2.right) + 10"
            />
          </div>
        </div>
      </div>
    </div>
  );
};