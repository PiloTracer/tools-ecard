/**
 * Offscreen Export Button
 * Export templates without opening them using off-screen canvas rendering
 */

'use client';

import { useState, useEffect } from 'react';
import { exportTemplateById, downloadDataUrl, estimateFileSizeKB } from '../../services/exportService';
import { templateService } from '../../services/templateService';
import type { ExportOptions } from '../../services/exportService';

interface OffscreenExportButtonProps {
  templateId: string;
  templateName: string;
  className?: string;
}

export function OffscreenExportButton({ templateId, templateName, className }: OffscreenExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep, setExportStep] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  // Template dimensions for aspect ratio calculation
  const [templateWidth, setTemplateWidth] = useState(1200);
  const [templateHeight, setTemplateHeight] = useState(600);

  // Export options
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [quality, setQuality] = useState(0.9);
  const [width, setWidth] = useState(2400);

  // Calculate height based on aspect ratio
  const calculatedHeight = Math.round(width * templateHeight / templateWidth);

  // Load template dimensions when modal opens
  useEffect(() => {
    if (showOptions) {
      templateService.loadTemplate(templateId).then(loaded => {
        setTemplateWidth(loaded.data.width || loaded.data.canvasWidth || 1200);
        setTemplateHeight(loaded.data.height || loaded.data.canvasHeight || 600);
      }).catch(err => {
        console.error('Failed to load template dimensions:', err);
      });
    }
  }, [showOptions, templateId]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStep('Starting export...');

    try {
      const options: ExportOptions = {
        format,
        quality: format === 'jpg' ? quality : 1.0,
        width,
        onProgress: (step, progress) => {
          setExportStep(step);
          setExportProgress(progress);
        }
      };

      const result = await exportTemplateById(templateId, options);

      // Download the exported image
      const filename = `${templateName.replace(/[^a-z0-9]/gi, '_')}.${result.format}`;
      downloadDataUrl(result.dataUrl, filename);

      // Show success message
      const sizeKB = estimateFileSizeKB(result.dataUrl);
      setExportStep(`✓ Exported ${result.width}x${result.height}px (${sizeKB}KB)`);

      // Close modal after short delay
      setTimeout(() => {
        setShowOptions(false);
        setExportStep('');
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStep(`✗ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowOptions(true)}
        className={className || 'px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm'}
        disabled={isExporting}
        title="Export template without opening"
      >
        {isExporting ? `${Math.round(exportProgress * 100)}%` : 'Export'}
      </button>

      {showOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Export Template</h3>
            <p className="text-sm text-gray-600 mb-4">{templateName}</p>

            <div className="space-y-4">
              {/* Format */}
              <div>
                <label className="block text-sm font-medium mb-2">Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormat('png')}
                    className={`px-4 py-2 rounded ${format === 'png' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => setFormat('jpg')}
                    className={`px-4 py-2 rounded ${format === 'jpg' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    JPG
                  </button>
                </div>
              </div>

              {/* Export Dimensions */}
              <div>
                <label className="block text-sm font-medium mb-2">Export Dimensions</label>

                {/* Dimensions Display */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{width}</div>
                      <div className="text-xs text-gray-600">Width (px)</div>
                    </div>
                    <div className="text-gray-400 text-2xl">×</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{calculatedHeight}</div>
                      <div className="text-xs text-gray-600">Height (px)</div>
                    </div>
                  </div>
                  <div className="text-center text-xs text-gray-500 mt-2">
                    Aspect ratio: {(templateWidth / templateHeight).toFixed(2)}:1
                  </div>
                </div>

                {/* Width Slider */}
                <input
                  type="range"
                  min="600"
                  max="5000"
                  step="100"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>600px</span>
                  <span>5000px</span>
                </div>
              </div>

              {/* Quality (JPG only) */}
              {format === 'jpg' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quality: {Math.round(quality * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* Progress */}
              {isExporting && (
                <div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${exportProgress * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{exportStep}</p>
                </div>
              )}

              {/* Status message */}
              {!isExporting && exportStep && (
                <p className="text-sm text-gray-600">{exportStep}</p>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
              <button
                onClick={() => setShowOptions(false)}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
