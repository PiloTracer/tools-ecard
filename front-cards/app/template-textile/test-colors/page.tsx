'use client';

import { useEffect } from 'react';
import { TemplateDesigner } from '@/features/template-textile';
import { useTemplateStore } from '@/features/template-textile/stores/templateStore';
import type { TextElement } from '@/features/template-textile/types';

export default function TestColorsPage() {
  useEffect(() => {
    // Add a test text element with multiple colors when the page loads
    const testElement: TextElement = {
      id: 'test-multi-color',
      type: 'text',
      x: 100,
      y: 100,
      text: 'Hello World This Is A Test',
      fontSize: 24,
      fontFamily: 'Arial',
      colors: ['#FF0000', '#00FF00', '#0000FF'], // Red, Green, Blue
      textAlign: 'left',
      rotation: 0,
      opacity: 1,
      locked: false,
    };

    // Add another test element with single color for comparison
    const singleColorElement: TextElement = {
      id: 'test-single-color',
      type: 'text',
      x: 100,
      y: 200,
      text: 'Single Color Text Example',
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#FF00FF', // Magenta
      textAlign: 'left',
      rotation: 0,
      opacity: 1,
      locked: false,
    };

    // Clear any existing elements and add test elements
    const store = useTemplateStore.getState();
    store.clearElements();
    store.addElement(testElement);
    store.addElement(singleColorElement);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 bg-white border-b">
        <h1 className="text-2xl font-bold text-gray-800">Test Per-Word Color Functionality</h1>
        <p className="text-sm text-gray-600 mt-2">
          Testing the new per-word color feature. The first text should show:
        </p>
        <ul className="text-sm text-gray-600 ml-4 mt-1 list-disc">
          <li>"Hello" in red</li>
          <li>"World" in green</li>
          <li>"This Is A Test" in blue (last color applies to remaining words)</li>
        </ul>
      </div>
      <TemplateDesigner />
    </div>
  );
}