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
      color: '#000000', // token-lint-ignore: persisted design data (vcard icon color)
      textAlign: 'left',
      rotation: 0,
      opacity: 1,
      locked: false,
      fieldId: fieldId, // Set the field identifier
    };
    addElement(textElement);
  };

  const categoryIcon = (id: string) => {
    const common = { className: 'h-4 w-4 text-text-muted', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', 'aria-hidden': true };
    if (id === 'business') {
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }
    if (id === 'personal') {
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  };

  const categories = [
    { id: 'core', label: 'Core Contact' },
    { id: 'business', label: 'Business' },
    { id: 'personal', label: 'Personal' },
  ];

  return (
    <div className="border-t border-border-subtle pt-3 mt-3">
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
                {categoryIcon(category.id)}
                <span className="text-sm font-semibold text-slate-500">{category.label}</span>
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
                    className="flex items-center gap-2 px-3 py-2 mx-1 rounded border border-border-subtle hover:border-blue-400 hover:bg-blue-50 cursor-move transition-all group"
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
                      <div className="text-xs font-medium text-slate-500 group-hover:text-blue-700">
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