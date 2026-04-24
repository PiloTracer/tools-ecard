'use client';

import { useState, useEffect, useRef } from 'react';
import { useTemplateStore } from '../../stores/templateStore';
import { useCanvasStore } from '../../stores/canvasStore';
import {
  fromPixels,
  toPixels,
  LENGTH_UNIT_OPTIONS,
  type LengthUnit,
} from '../../utils/lengthUnits';

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
  const {
    canvasWidth,
    canvasHeight,
    exportWidth,
    canvasSizeUnit,
    setCanvasDimensions,
    setExportWidth,
    setCanvasSizeUnit,
  } = useTemplateStore();
  const { setDimensions, fabricCanvas, setZoom } = useCanvasStore();

  const [showSettings, setShowSettings] = useState(false);
  const [draftW, setDraftW] = useState(() => String(fromPixels(canvasWidth, canvasSizeUnit)));
  const [draftH, setDraftH] = useState(() => String(fromPixels(canvasHeight, canvasSizeUnit)));
  const [draftE, setDraftE] = useState(() => String(fromPixels(exportWidth, canvasSizeUnit)));

  const prevW = useRef(canvasWidth);
  const prevH = useRef(canvasHeight);
  const prevE = useRef(exportWidth);
  const prevU = useRef(canvasSizeUnit);

  useEffect(() => {
    const u = canvasSizeUnit;
    if (u !== prevU.current) {
      prevU.current = u;
      prevW.current = canvasWidth;
      prevH.current = canvasHeight;
      prevE.current = exportWidth;
      setDraftW(String(fromPixels(canvasWidth, u)));
      setDraftH(String(fromPixels(canvasHeight, u)));
      setDraftE(String(fromPixels(exportWidth, u)));
      return;
    }
    if (canvasWidth !== prevW.current) {
      prevW.current = canvasWidth;
      setDraftW(String(fromPixels(canvasWidth, u)));
    }
    if (canvasHeight !== prevH.current) {
      prevH.current = canvasHeight;
      setDraftH(String(fromPixels(canvasHeight, u)));
    }
    if (exportWidth !== prevE.current) {
      prevE.current = exportWidth;
      setDraftE(String(fromPixels(exportWidth, u)));
    }
  }, [canvasWidth, canvasHeight, exportWidth, canvasSizeUnit]);

  const handlePresetSelect = (preset: AspectRatioPreset) => {
    setCanvasSizeUnit('px');
    setCanvasDimensions(preset.width, preset.height);
    setDimensions(preset.width, preset.height);
    setDraftW(String(preset.width));
    setDraftH(String(preset.height));
  };

  const handleCustomDimensions = () => {
    const wPx = toPixels(parseFloat(draftW) || 0, canvasSizeUnit);
    const hPx = toPixels(parseFloat(draftH) || 0, canvasSizeUnit);
    if (wPx >= 100 && hPx >= 100 && wPx <= 10000 && hPx <= 10000) {
      setCanvasDimensions(wPx, hPx);
      setDimensions(wPx, hPx);
    }
  };

  const onCanvasUnitChange = (u: LengthUnit) => {
    setCanvasSizeUnit(u);
  };

  const commitExportWidth = () => {
    const v = parseFloat(draftE);
    if (Number.isNaN(v)) {
      setDraftE(String(fromPixels(exportWidth, canvasSizeUnit)));
      return;
    }
    const px = toPixels(v, canvasSizeUnit);
    const clamped = Math.max(100, Math.min(10000, px || 0));
    setExportWidth(clamped);
    setDraftE(String(fromPixels(clamped, canvasSizeUnit)));
  };

  const handleResetView = () => {
    if (!fabricCanvas) return;
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.setZoom(1);
    setZoom(1);
    fabricCanvas.renderAll();
  };

  const currentAspectRatio = (canvasWidth / canvasHeight).toFixed(2);
  const exportHeightPx = Math.round(exportWidth / (canvasWidth / canvasHeight));

  return (
    <div className="border-b border-slate-700 bg-slate-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Canvas Settings
          <span className="text-xs text-slate-400">
            ({canvasWidth}×{canvasHeight} px • {currentAspectRatio}:1)
          </span>
        </button>

        <button
          onClick={handleResetView}
          className="flex items-center gap-2 rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-600"
          title="Reset zoom to 100% and center the canvas"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 11H3m0 0l3 3m-3-3l3-3m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Reset View
        </button>
      </div>

      {showSettings && (
        <div className="mt-3 space-y-4 rounded border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Physical units use CSS resolution (96 px = 1 in). Stored sizes are always pixels.</p>
          <div>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIO_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                    canvasWidth === preset.width && canvasHeight === preset.height
                      ? 'border-blue-400 bg-blue-600 text-white'
                      : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-xs opacity-75">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs text-slate-500">
              One unit for canvas size, export base width, and the export dialog (px / cm / in).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="shrink-0">
                <label className="mb-1 block text-xs text-slate-400">Unit</label>
                <select
                  value={canvasSizeUnit}
                  onChange={(e) => onCanvasUnitChange(e.target.value as LengthUnit)}
                  className="w-[4.25rem] rounded border border-slate-600 bg-slate-800 py-2 pl-2 pr-1 text-sm text-white"
                >
                  {LENGTH_UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[4.5rem] flex-1 sm:max-w-[10rem]">
                <label className="mb-1 block text-xs text-slate-400">Width</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draftW}
                  onChange={(e) => setDraftW(e.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="min-w-[4.5rem] flex-1 sm:max-w-[10rem]">
                <label className="mb-1 block text-xs text-slate-400">Height</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draftH}
                  onChange={(e) => setDraftH(e.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleCustomDimensions}
                className="shrink-0 rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-600"
              >
                Apply
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Canvas: {canvasWidth}×{canvasHeight} px</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Export base width – canvas scales to this (same unit as above)
            </label>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={draftE}
              onChange={(e) => setDraftE(e.target.value)}
              onBlur={commitExportWidth}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full max-w-sm rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-2 text-sm text-slate-300">
              Export:{' '}
              <span className="font-semibold text-white">
                {exportWidth}×{exportHeightPx} px
              </span>
            </p>
            <p className="text-xs text-slate-500">
              ≈ {fromPixels(exportWidth, 'in').toFixed(3)}×{fromPixels(exportHeightPx, 'in').toFixed(3)} in •{' '}
              {fromPixels(exportWidth, 'cm').toFixed(1)}×{fromPixels(exportHeightPx, 'cm').toFixed(1)} cm
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
