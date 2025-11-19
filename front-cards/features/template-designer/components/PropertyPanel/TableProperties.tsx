'use client';

import React from 'react';
import type { TableElement } from '../../types';

interface TablePropertiesProps {
  element: TableElement;
  onUpdate: (element: TableElement) => void;
}

export const TableProperties: React.FC<TablePropertiesProps> = ({
  element,
  onUpdate
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Table Properties
      </h4>

      {/* Table Dimensions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Rows
          </label>
          <input
            type="number"
            value={element.rows}
            onChange={(e) =>
              onUpdate({ ...element, rows: parseInt(e.target.value) || 1 })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            min="1"
            max="10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Columns
          </label>
          <input
            type="number"
            value={element.columns}
            onChange={(e) =>
              onUpdate({ ...element, columns: parseInt(e.target.value) || 1 })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            min="1"
            max="10"
          />
        </div>
      </div>

      {/* Cell Dimensions */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cell Width
          </label>
          <input
            type="number"
            value={element.cellWidth}
            onChange={(e) =>
              onUpdate({ ...element, cellWidth: parseInt(e.target.value) || 100 })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            min="20"
            max="500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cell Height
          </label>
          <input
            type="number"
            value={element.cellHeight}
            onChange={(e) =>
              onUpdate({ ...element, cellHeight: parseInt(e.target.value) || 30 })
            }
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            min="20"
            max="200"
          />
        </div>
      </div>

      {/* Border Settings */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Border Width
        </label>
        <input
          type="number"
          value={element.borderWidth || 1}
          onChange={(e) =>
            onUpdate({ ...element, borderWidth: parseInt(e.target.value) || 0 })
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          min="0"
          max="10"
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Border Color
          </label>
          <div className="flex gap-1">
            <input
              type="color"
              value={element.borderColor || '#cccccc'}
              onChange={(e) => onUpdate({ ...element, borderColor: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={element.borderColor || '#cccccc'}
              onChange={(e) => onUpdate({ ...element, borderColor: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="#cccccc"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Background
          </label>
          <div className="flex gap-1">
            <input
              type="color"
              value={element.backgroundColor || '#ffffff'}
              onChange={(e) =>
                onUpdate({ ...element, backgroundColor: e.target.value })
              }
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={element.backgroundColor || '#ffffff'}
              onChange={(e) =>
                onUpdate({ ...element, backgroundColor: e.target.value })
              }
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="#ffffff"
            />
          </div>
        </div>
      </div>

      {/* Auto Collapse */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="autoCollapse"
          checked={element.autoCollapse || false}
          onChange={(e) =>
            onUpdate({ ...element, autoCollapse: e.target.checked })
          }
          className="mr-2"
        />
        <label htmlFor="autoCollapse" className="text-xs font-medium text-gray-700">
          Auto-collapse empty rows
        </label>
      </div>

      {/* Cell Content Management */}
      <div className="border-t border-gray-200 pt-4">
        <h5 className="text-xs font-medium text-gray-700 mb-2">
          Cell Contents
        </h5>
        <p className="text-xs text-gray-500 mb-3">
          Click on cells in the canvas to add elements to them
        </p>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: element.rows * element.columns }).map((_, index) => {
            const row = Math.floor(index / element.columns);
            const col = index % element.columns;
            const cell = element.cells.find(
              c => c.row === row && c.column === col
            );

            return (
              <div
                key={index}
                className={`
                  h-8 border border-gray-300 rounded text-xs flex items-center justify-center
                  ${cell?.element ? 'bg-blue-50' : 'bg-white'}
                  hover:bg-gray-50 cursor-pointer transition-colors
                `}
                title={`Cell ${row + 1},${col + 1}`}
              >
                {cell?.element ? '•' : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Table Templates */}
      <div className="border-t border-gray-200 pt-4">
        <h5 className="text-xs font-medium text-gray-700 mb-2">
          Quick Templates
        </h5>
        <div className="space-y-1">
          <button className="w-full px-3 py-2 text-xs text-left bg-gray-50 hover:bg-gray-100 rounded transition-colors">
            Contact Info Table
          </button>
          <button className="w-full px-3 py-2 text-xs text-left bg-gray-50 hover:bg-gray-100 rounded transition-colors">
            Social Media Icons
          </button>
          <button className="w-full px-3 py-2 text-xs text-left bg-gray-50 hover:bg-gray-100 rounded transition-colors">
            Department Grid
          </button>
        </div>
      </div>
    </div>
  );
};