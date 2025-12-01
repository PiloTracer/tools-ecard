'use client';

import { useState } from 'react';
import { useTemplateStore } from '../../stores/templateStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { vcardFields, getFieldsByCategory, truncatePlaceholder } from '../../utils/vcardFields';
import type { TextElement } from '../../types';

export function VCardFieldsSection() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    core: false,
    business: false,
    personal: false,
  });

  const { addElement } = useTemplateStore();
  const { width, height } = useCanvasStore();

  const handleToggleCategory = (category: string) => {
    setExpanded(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleDragStart = (e: React.DragEvent, fieldId: string, placeholder: string) => {
    e.dataTransfer.setData('vcardField', JSON.stringify({ fieldId, placeholder }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddField = (fieldId: string, placeholder: string) => {
    const textElement: TextElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: width / 2 - 100,
      y: height / 2 - 20,
      text: placeholder, // Use placeholder value with trailing spaces
      fontSize: 16,
      fontFamily: 'Arial',
      color: '#000000',
      textAlign: 'left',
      rotation: 0,
      opacity: 1,
      locked: false,
      fieldId: fieldId, // Set the field identifier
    };
    addElement(textElement);
  };

  const categories = [
    { id: 'core', label: 'Core Contact', icon: '📧' },
    { id: 'business', label: 'Business', icon: '💼' },
    { id: 'personal', label: 'Personal', icon: '👤' },
  ];

  return (
    <div className="border-t border-slate-200 pt-3 mt-3">
      <div className="text-xs font-semibold text-slate-600 mb-2 px-1">VCARD FIELDS</div>

      {categories.map(category => {
        const fields = getFieldsByCategory(category.id as 'core' | 'business' | 'personal');
        const isExpanded = expanded[category.id];

        return (
          <div key={category.id} className="mb-2">
            <button
              onClick={() => handleToggleCategory(category.id)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{category.icon}</span>
                <span className="text-sm font-medium text-slate-700">{category.label}</span>
                <span className="text-xs text-slate-500">({fields.length})</span>
              </div>
              <svg
                className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-1 space-y-1">
                {fields.map(field => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, field.id, field.placeholder)}
                    onClick={() => handleAddField(field.id, field.placeholder)}
                    className="flex items-center gap-2 px-3 py-2 mx-1 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50 cursor-move transition-all group"
                    title={field.placeholder}
                  >
                    <svg
                      className="h-3 w-3 text-slate-400 group-hover:text-blue-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 group-hover:text-blue-700">
                        {field.id.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-slate-500 group-hover:text-blue-600 truncate">
                        {truncatePlaceholder(field.placeholder, 20)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}