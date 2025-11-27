'use client';

import { useRef } from 'react';
import { useTemplateStore } from '../../stores/templateStore';
import type { ImageElement } from '../../types';
import { LineMetadataProperties } from './LineMetadataProperties';

interface ImagePropertiesProps {
  element: ImageElement;
}

export function ImageProperties({ element }: ImagePropertiesProps) {
  const { updateElement, canvasWidth, canvasHeight } = useTemplateStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (updates: Partial<ImageElement>) => {
    updateElement(element.id, updates);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.svg')) {
      alert('Please upload a PNG, JPG, or SVG file');
      return;
    }

    // Handle SVG differently
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const svgContent = event.target?.result as string;
        const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);

        // Get SVG dimensions
        const img = new Image();
        img.onload = () => {
          const svgWidth = img.width;
          const svgHeight = img.height;

          // RASTERIZE at 5x resolution for high quality
          const rasterWidth = svgWidth * 5;
          const rasterHeight = svgHeight * 5;

          console.log('SVG dimensions:', svgWidth, 'x', svgHeight);
          console.log('Rasterizing to:', rasterWidth, 'x', rasterHeight);

          // Create canvas at 5x resolution
          const canvas = document.createElement('canvas');
          canvas.width = rasterWidth;
          canvas.height = rasterHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            console.error('Failed to get canvas context');
            return;
          }

          // Draw SVG at 5x resolution
          ctx.drawImage(img, 0, 0, rasterWidth, rasterHeight);

          // Convert to PNG data URL
          const pngDataUrl = canvas.toDataURL('image/png', 1.0);

          console.log('SVG rasterized to PNG:', pngDataUrl.length, 'bytes');

          // Calculate box size to fit 50% of canvas area
          const maxWidth = canvasWidth * 0.5;
          const maxHeight = canvasHeight * 0.5;

          let boxWidth = svgWidth;
          let boxHeight = svgHeight;

          // Scale to fit within 50% of canvas
          if (boxWidth > maxWidth || boxHeight > maxHeight) {
            const widthRatio = maxWidth / boxWidth;
            const heightRatio = maxHeight / boxHeight;
            const scale = Math.min(widthRatio, heightRatio);

            boxWidth = Math.round(boxWidth * scale);
            boxHeight = Math.round(boxHeight * scale);
          }

          console.log('Box size:', boxWidth, 'x', boxHeight);

          handleChange({
            imageUrl: pngDataUrl,  // Use rasterized PNG
            width: boxWidth,
            height: boxHeight,
            originalWidth: boxWidth,
            originalHeight: boxHeight
          });

          URL.revokeObjectURL(url);
        };
        img.src = url;
      };
      reader.readAsText(file);
    } else {
      // Handle PNG/JPG
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          const originalWidth = img.width;
          const originalHeight = img.height;

          // Calculate 50% of canvas area while maintaining aspect ratio
          const maxWidth = canvasWidth * 0.5;
          const maxHeight = canvasHeight * 0.5;

          let newWidth = originalWidth;
          let newHeight = originalHeight;

          // Scale to fit within 50% of canvas
          if (newWidth > maxWidth || newHeight > maxHeight) {
            const widthRatio = maxWidth / newWidth;
            const heightRatio = maxHeight / newHeight;
            const scale = Math.min(widthRatio, heightRatio);

            newWidth = Math.round(newWidth * scale);
            newHeight = Math.round(newHeight * scale);
          }

          console.log('PNG/JPG imported:', { originalWidth, originalHeight, newWidth, newHeight });

          handleChange({
            imageUrl: dataUrl,
            width: newWidth,
            height: newHeight,
            originalWidth: newWidth,
            originalHeight: newHeight
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Import Button */}
      <div>
        <button
          onClick={handleImport}
          className="w-full rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 px-4 py-6 text-center hover:bg-blue-100 hover:border-blue-500 transition-all"
        >
          <svg className="mx-auto h-12 w-12 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div className="font-semibold text-blue-900">Import Image</div>
          <div className="text-xs text-blue-700 mt-1">PNG, JPG, or SVG</div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Image Preview */}
      {element.imageUrl && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Preview</label>
          <div className="rounded border-2 border-gray-300 p-2 bg-gray-50 flex items-center justify-center" style={{ height: '120px' }}>
            <img
              src={element.imageUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="mt-1 text-xs text-gray-500 truncate" title={element.imageUrl}>
            {element.imageUrl.substring(0, 50)}...
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Width</label>
          <input
            type="number"
            value={isNaN(element.width) ? 100 : element.width}
            onChange={(e) => handleChange({ width: parseInt(e.target.value) || 100 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={10}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Height</label>
          <input
            type="number"
            value={isNaN(element.height) ? 100 : element.height}
            onChange={(e) => handleChange({ height: parseInt(e.target.value) || 100 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={10}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Opacity</label>
        <input
          type="range"
          value={(element.opacity || 1) * 100}
          onChange={(e) => handleChange({ opacity: parseInt(e.target.value) / 100 })}
          className="w-full"
          min={0}
          max={100}
        />
        <div className="text-xs text-gray-500 text-right">{Math.round((element.opacity || 1) * 100)}%</div>
      </div>

      {/* Line Metadata Section */}
      <LineMetadataProperties element={element} />
    </div>
  );
}
