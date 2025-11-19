'use client';

import React from 'react';

interface ElementToolboxProps {
  onAddText: () => void;
  onAddImage: () => void;
  onAddQR: () => void;
  onAddTable: () => void;
}

export const ElementToolbox: React.FC<ElementToolboxProps> = ({
  onAddText,
  onAddImage,
  onAddQR,
  onAddTable
}) => {
  const quickFields = [
    { label: 'Full Name', field: 'fullName' },
    { label: 'Position', field: 'position' },
    { label: 'Department', field: 'department' },
    { label: 'Email', field: 'email' },
    { label: 'Phone', field: 'phone' },
    { label: 'Extension', field: 'extension' },
    { label: 'WhatsApp', field: 'whatsapp' },
    { label: 'Website', field: 'website' }
  ];

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
          Elements
        </h3>

        <div className="space-y-2">
          <button
            onClick={onAddText}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all duration-200 group"
          >
            <div className="p-2 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-medium text-sm text-gray-900">Text</div>
              <div className="text-xs text-gray-500">Add text element</div>
            </div>
          </button>

          <button
            onClick={onAddImage}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all duration-200 group"
          >
            <div className="p-2 bg-green-50 rounded-md group-hover:bg-green-100 transition-colors">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-medium text-sm text-gray-900">Image</div>
              <div className="text-xs text-gray-500">Add image or icon</div>
            </div>
          </button>

          <button
            onClick={onAddQR}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all duration-200 group"
          >
            <div className="p-2 bg-purple-50 rounded-md group-hover:bg-purple-100 transition-colors">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h8m-4 0v8m-4 0h.01M8 8h.01M12 8h.01M16 8h.01M20 8h.01M4 20h.01M8 20h.01M4 16h.01M4 4h16v4H4V4z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-medium text-sm text-gray-900">QR Code</div>
              <div className="text-xs text-gray-500">Add QR code</div>
            </div>
          </button>

          <button
            onClick={onAddTable}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all duration-200 group"
          >
            <div className="p-2 bg-orange-50 rounded-md group-hover:bg-orange-100 transition-colors">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-medium text-sm text-gray-900">Table</div>
              <div className="text-xs text-gray-500">Add table container</div>
            </div>
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            Quick Fields
          </h3>
          <div className="space-y-1">
            {quickFields.map((field) => (
              <button
                key={field.field}
                onClick={() => {
                  // Add text element with pre-configured field
                  onAddText();
                  // TODO: Set field value on the new element
                }}
                className="w-full text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                title={`Add ${field.label} field`}
              >
                <span className="font-medium">{field.label}</span>
                <span className="text-gray-500 ml-1">({field.field})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            Templates
          </h3>
          <div className="space-y-2">
            <button className="w-full p-2 text-xs text-left bg-gray-50 hover:bg-gray-100 rounded transition-colors">
              Business Card Layout
            </button>
            <button className="w-full p-2 text-xs text-left bg-gray-50 hover:bg-gray-100 rounded transition-colors">
              QR Contact Card
            </button>
            <button className="w-full p-2 text-xs text-left bg-gray-50 hover:bg-gray-100 rounded transition-colors">
              Simple Badge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};