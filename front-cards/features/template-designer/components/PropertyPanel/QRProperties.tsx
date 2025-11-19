'use client';

import React from 'react';
import type { QRElement } from '../../types';

interface QRPropertiesProps {
  element: QRElement;
  onUpdate: (element: QRElement) => void;
}

export const QRProperties: React.FC<QRPropertiesProps> = ({
  element,
  onUpdate
}) => {
  const qrTypeOptions = [
    { value: 'text', label: 'Plain Text' },
    { value: 'url', label: 'URL/Website' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'vcard', label: 'vCard Contact' }
  ];

  const errorCorrectionOptions = [
    { value: 'L', label: 'Low (7%)' },
    { value: 'M', label: 'Medium (15%)' },
    { value: 'Q', label: 'Quartile (25%)' },
    { value: 'H', label: 'High (30%)' }
  ];

  const fieldOptions = [
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'website', label: 'Website' },
    { value: 'vcard', label: 'vCard (All Contact Info)' },
    { value: 'custom', label: 'Custom Field' }
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        QR Code Properties
      </h4>

      {/* Data Source */}
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

      {/* QR Type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          QR Code Type
        </label>
        <select
          value={element.qrType}
          onChange={(e) =>
            onUpdate({
              ...element,
              qrType: e.target.value as QRElement['qrType']
            })
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
        >
          {qrTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Size Settings */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          QR Code Size
        </label>
        <input
          type="number"
          value={element.size}
          onChange={(e) =>
            onUpdate({ ...element, size: parseInt(e.target.value) || 100 })
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          min="50"
          max="500"
        />
      </div>

      {/* Margin */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Quiet Zone Margin
        </label>
        <input
          type="number"
          value={element.margin}
          onChange={(e) =>
            onUpdate({ ...element, margin: parseInt(e.target.value) || 4 })
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
            Dark Color
          </label>
          <div className="flex gap-1">
            <input
              type="color"
              value={element.colorDark}
              onChange={(e) => onUpdate({ ...element, colorDark: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={element.colorDark}
              onChange={(e) => onUpdate({ ...element, colorDark: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="#000000"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Light Color
          </label>
          <div className="flex gap-1">
            <input
              type="color"
              value={element.colorLight}
              onChange={(e) => onUpdate({ ...element, colorLight: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={element.colorLight}
              onChange={(e) => onUpdate({ ...element, colorLight: e.target.value })}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="#FFFFFF"
            />
          </div>
        </div>
      </div>

      {/* Error Correction */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Error Correction Level
        </label>
        <select
          value={element.errorCorrection}
          onChange={(e) =>
            onUpdate({
              ...element,
              errorCorrection: e.target.value as QRElement['errorCorrection']
            })
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
        >
          {errorCorrectionOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Higher levels allow for more damage but reduce data capacity
        </p>
      </div>

      {/* Logo Settings */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center mb-3">
          <input
            type="checkbox"
            id="qrLogo"
            checked={!!element.logo}
            onChange={(e) => {
              if (e.target.checked) {
                onUpdate({
                  ...element,
                  logo: {
                    url: '',
                    size: 20
                  }
                });
              } else {
                onUpdate({
                  ...element,
                  logo: undefined
                });
              }
            }}
            className="mr-2"
          />
          <label htmlFor="qrLogo" className="text-xs font-medium text-gray-700">
            Add logo to QR code center
          </label>
        </div>

        {element.logo && (
          <div className="space-y-2 pl-6">
            <button className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">
              Select Logo
            </button>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Logo Size (%)
              </label>
              <input
                type="range"
                min="10"
                max="30"
                value={element.logo.size}
                onChange={(e) =>
                  onUpdate({
                    ...element,
                    logo: {
                      ...element.logo!,
                      size: parseInt(e.target.value)
                    }
                  })
                }
                className="w-full"
              />
              <div className="text-xs text-gray-500 text-center">
                {element.logo.size}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};