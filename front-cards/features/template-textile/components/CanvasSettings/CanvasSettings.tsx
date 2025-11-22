'use client';

import { useState } from 'react';
import { useTemplateStore } from '../../stores/templateStore';
import { useCanvasStore } from '../../stores/canvasStore';

type AspectRatioPreset = {
  name: string;
  width: number;
  height: number;
  description: string;
};

const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  {
    name: 'Business E-Card',
    width: 1076,
    height: 380,
    description: '2.83:1 - Digital business card',
  },
  {
    name: 'QR Code',
    width: 500,
    height: 500,
    description: '1:1 - Square format',
  },
  {
    name: 'Standard Business Card (US)',
    width: 1050,
    height: 600,
    description: '3.5:2 - 1050x600 px',
  },
  {
    name: 'ISO Business Card',
    width: 850,
    height: 550,
    description: '85:55 - ISO 7810',
  },
  {
    name: '16:9 (Widescreen)',
    width: 1920,
    height: 1080,
    description: 'HD format',
  },
  {
    name: '4:3 (Classic)',
    width: 1024,
    height: 768,
    description: 'Classic screen',
  },
  {
    name: '9:16 (Vertical)',
    width: 1080,
    height: 1920,
    description: 'Mobile/Cellphone',
  },
];

export function CanvasSettings() {
  const { canvasWidth, canvasHeight, exportWidth, setCanvasDimensions, setExportWidth } = useTemplateStore();
  const { setDimensions, fabricCanvas, setZoom } = useCanvasStore();
  const [customWidth, setCustomWidth] = useState(canvasWidth);
  const [customHeight, setCustomHeight] = useState(canvasHeight);
  const [showSettings, setShowSettings] = useState(false);

  const handlePresetSelect = (preset: AspectRatioPreset) => {
    setCanvasDimensions(preset.width, preset.height);
    setDimensions(preset.width, preset.height);
    setCustomWidth(preset.width);
    setCustomHeight(preset.height);
  };

  const handleCustomDimensions = () => {
    if (customWidth > 0 && customHeight > 0) {
      setCanvasDimensions(customWidth, customHeight);
      setDimensions(customWidth, customHeight);
    }
  };

  const handleResetView = () => {
    if (!fabricCanvas) return;

    // Reset viewport transform to default (no pan, no zoom)
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    // Reset zoom to 100%
    fabricCanvas.setZoom(1);
    // Update the store's zoom state
    setZoom(1);
    // Re-render the canvas
    fabricCanvas.renderAll();
  };

  const currentAspectRatio = (canvasWidth / canvasHeight).toFixed(2);

  return (
    <div className="border-b border-slate-700 bg-slate-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Canvas Settings
          <span className="text-xs text-slate-400">
            ({canvasWidth}x{canvasHeight} • {currentAspectRatio})
          </span>
        </button>

        <button
          onClick={handleResetView}
          className="flex items-center gap-2 rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Reset zoom to 100% and center the canvas"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11H3m0 0l3 3m-3-3l3-3m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Reset View
        </button>
      </div>

      {showSettings && (
        <div className="mt-3 space-y-4 rounded border border-slate-700 bg-slate-900 p-4">
          {/* Preset Aspect Ratios */}
          <div>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIO_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                    canvasWidth === preset.width && canvasHeight === preset.height
                      ? 'border-blue-400 bg-blue-600 text-white'
                      : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-xs opacity-75">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Dimensions */}
          <div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-400">Width (px)</label>
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  min={100}
                  max={5000}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-400">Height (px)</label>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  min={100}
                  max={5000}
                />
              </div>
              <button
                onClick={handleCustomDimensions}
                className="mt-5 rounded border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Export Width */}
          <div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Export Width (px) - Canvas will scale to this width
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={exportWidth}
                  onChange={(e) => setExportWidth(parseInt(e.target.value) || 1920)}
                  className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  min={100}
                  max={10000}
                  step={100}
                />
                <span className="text-xs text-slate-400">
                  Export: {exportWidth}x{Math.round(exportWidth / (canvasWidth / canvasHeight))} px
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
