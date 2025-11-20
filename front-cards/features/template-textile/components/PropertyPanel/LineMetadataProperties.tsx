'use client';

import { useState, useMemo } from 'react';
import { useTemplateStore } from '../../stores/templateStore';
import type { BaseElement } from '../../types';
import { vcardFields } from '../../utils/vcardFields';

interface LineMetadataPropertiesProps {
  element: BaseElement;
}

export function LineMetadataProperties({ element }: LineMetadataPropertiesProps) {
  const { updateElement, elements } = useTemplateStore();
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  const handleChange = (updates: Partial<BaseElement>) => {
    updateElement(element.id, updates);
  };

  // Get existing line groups from other elements for suggestions
  const existingLineGroups = useMemo(() => {
    const groups = new Set<string>();
    elements.forEach(el => {
      if (el.lineGroup && el.id !== element.id) {
        groups.add(el.lineGroup);
      }
    });
    return Array.from(groups).sort();
  }, [elements, element.id]);

  // Generate line group suggestions
  const lineGroupSuggestions = [
    'contact-line-1',
    'contact-line-2',
    'contact-line-3',
    'phone-line',
    'email-line',
    'address-line',
    'social-line',
    'business-line',
    ...existingLineGroups
  ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

  const handleAddRequiredField = (fieldId: string) => {
    const currentFields = element.requiredFields || [];
    if (!currentFields.includes(fieldId)) {
      handleChange({ requiredFields: [...currentFields, fieldId] });
    }
    setShowFieldSelector(false);
  };

  const handleRemoveRequiredField = (fieldId: string) => {
    const currentFields = element.requiredFields || [];
    handleChange({ requiredFields: currentFields.filter(f => f !== fieldId) });
  };

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4">
      <h3 className="text-sm font-semibold text-gray-700">Line Metadata</h3>

      {/* Line Group */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Line Group</label>
        <input
          type="text"
          value={element.lineGroup || ''}
          onChange={(e) => handleChange({ lineGroup: e.target.value })}
          placeholder="e.g., contact-line-1"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          list="lineGroupSuggestions"
        />
        <datalist id="lineGroupSuggestions">
          {lineGroupSuggestions.map(suggestion => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-gray-500">
          Group elements that form a functional line
        </p>
      </div>

      {/* Line Priority */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Line Priority</label>
        <input
          type="number"
          value={element.linePriority || ''}
          onChange={(e) => handleChange({ linePriority: parseInt(e.target.value) || undefined })}
          placeholder="1, 2, 3..."
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          min={1}
          max={100}
        />
        <p className="mt-1 text-xs text-gray-500">
          Order for automatic line reordering (lower = higher priority)
        </p>
      </div>

      {/* Required Fields */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Required Fields</label>
        <div className="space-y-2">
          {/* Display current required fields */}
          {element.requiredFields && element.requiredFields.length > 0 && (
            <div className="space-y-1">
              {element.requiredFields.map(fieldId => {
                const field = vcardFields.find(f => f.id === fieldId);
                return (
                  <div key={fieldId} className="flex items-center justify-between rounded bg-blue-50 px-2 py-1">
                    <span className="text-xs font-medium text-blue-800">
                      {field ? field.id : fieldId}
                    </span>
                    <button
                      onClick={() => handleRemoveRequiredField(fieldId)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add field button */}
          <button
            onClick={() => setShowFieldSelector(!showFieldSelector)}
            className="w-full rounded border-2 border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add Required Field
          </button>

          {/* Field selector dropdown */}
          {showFieldSelector && (
            <div className="rounded border border-gray-300 bg-white max-h-48 overflow-y-auto shadow-lg">
              <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-700">Select vCard Field</p>
              </div>
              {vcardFields.map(field => (
                <button
                  key={field.id}
                  onClick={() => handleAddRequiredField(field.id)}
                  disabled={element.requiredFields?.includes(field.id)}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${
                    element.requiredFields?.includes(field.id)
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : ''
                  }`}
                >
                  <div className="font-medium text-gray-800">{field.id}</div>
                  <div className="text-gray-500 truncate">{field.placeholder.trim()}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Line will be hidden if any required field is empty
        </p>
      </div>

      {/* Summary */}
      {element.lineGroup && (
        <div className="rounded bg-gray-50 p-3 text-xs">
          <p className="font-semibold text-gray-700 mb-1">Metadata Summary:</p>
          <ul className="space-y-1 text-gray-600">
            <li>• Group: <span className="font-medium">{element.lineGroup}</span></li>
            {element.linePriority && (
              <li>• Priority: <span className="font-medium">{element.linePriority}</span></li>
            )}
            {element.requiredFields && element.requiredFields.length > 0 && (
              <li>• Required: <span className="font-medium">{element.requiredFields.join(', ')}</span></li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}