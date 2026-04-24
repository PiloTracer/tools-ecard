/**
 * Offscreen Export Button
 * Export templates without opening them using off-screen canvas rendering
 * Supports both single template export and batch export with record data
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { exportTemplateById, exportTemplate, downloadDataUrl, estimateFileSizeKB } from '../../services/exportService';
import { templateService } from '../../services/templateService';
import { exportTemplateToBatch, downloadZip } from '../../services/batchExportService';
import type { ExportOptions } from '../../services/exportService';
import type { Template } from '../../types';
import type { Batch } from '@/features/batch-view/types';
import { batchViewService } from '@/features/batch-view/services/batchViewService';
import { useTemplateStore } from '../../stores/templateStore';
import { fromPixels, toPixels, unitLabel, type LengthUnit } from '../../utils/lengthUnits';

function clampExportWidthPx(px: number): number {
  return Math.max(100, Math.min(10000, Math.round(px)));
}

function backgroundLabel(hex?: string): string {
  if (!hex) return 'White';
  const n = hex.trim().toLowerCase();
  if (n === '#ffffff' || n === '#fff' || n === 'white') return 'White';
  if (n === 'transparent') return 'Transparent';
  return hex;
}

interface OffscreenExportButtonProps {
  templateId?: string;
  template?: Template;
  templateName: string;
  className?: string;
  buttonLabel?: string;
}

export function OffscreenExportButton({
  templateId,
  template,
  templateName,
  className,
  buttonLabel = 'Export',
}: OffscreenExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep, setExportStep] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const [exportMode, setExportMode] = useState<'single' | 'batch'>('single');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  const [templateWidth, setTemplateWidth] = useState(1200);
  const [templateHeight, setTemplateHeight] = useState(600);

  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [quality, setQuality] = useState(0.9);
  const [width, setWidth] = useState(1920);
  /** Unit for loaded template when not the active editor tab (e.g. export by id) */
  const [unitFromSource, setUnitFromSource] = useState<LengthUnit>('px');
  const [transparentBackground, setTransparentBackground] = useState(false);

  const currentTemplate = useTemplateStore((s) => s.currentTemplate);
  const storeExportWidth = useTemplateStore((s) => s.exportWidth);
  const storeCanvasSizeUnit = useTemplateStore((s) => s.canvasSizeUnit);
  const setStoreExportWidth = useTemplateStore((s) => s.setExportWidth);

  const isEditorTemplate = Boolean(
    template && currentTemplate && template.id === currentTemplate.id
  );

  const calculatedHeight = Math.round((width * templateHeight) / templateWidth);

  const updateExportWidthPx = useCallback(
    (px: number) => {
      const w = clampExportWidthPx(px);
      setWidth(w);
      if (isEditorTemplate) {
        setStoreExportWidth(w);
      }
    },
    [isEditorTemplate, setStoreExportWidth]
  );

  const displayUnit: LengthUnit = isEditorTemplate
    ? storeCanvasSizeUnit
    : template
      ? (template.canvasSizeUnit ?? template.exportBaseWidthUnit ?? 'px')
      : unitFromSource;

  const onBaseWidthInput = useCallback(
    (v: number) => {
      updateExportWidthPx(toPixels(v, displayUnit));
    },
    [displayUnit, updateExportWidthPx]
  );

  // Canvas dimensions: from prop or load by id
  useEffect(() => {
    if (!showOptions) return;
    if (template) {
      setTemplateWidth(template.width || template.canvasWidth || 1200);
      setTemplateHeight(template.height || template.canvasHeight || 600);
    } else if (templateId) {
      templateService
        .loadTemplate(templateId)
        .then((loaded) => {
          setTemplateWidth(loaded.data.width || loaded.data.canvasWidth || 1200);
          setTemplateHeight(loaded.data.height || loaded.data.canvasHeight || 600);
        })
        .catch((err) => {
          console.error('Failed to load template dimensions:', err);
        });
    }
  }, [showOptions, templateId, template]);

  // Export base width: match canvas / store when editing, else file
  useEffect(() => {
    if (!showOptions) return;

    if (template) {
      if (isEditorTemplate) {
        setWidth(clampExportWidthPx(storeExportWidth));
      } else {
        setWidth(clampExportWidthPx(template.exportWidth ?? 1920));
        setUnitFromSource(template.canvasSizeUnit ?? template.exportBaseWidthUnit ?? 'px');
      }
      return;
    }

    if (templateId) {
      templateService
        .loadTemplate(templateId)
        .then((loaded) => {
          const t = loaded.data;
          setWidth(clampExportWidthPx(t.exportWidth ?? 1920));
          setUnitFromSource(t.canvasSizeUnit ?? t.exportBaseWidthUnit ?? 'px');
        })
        .catch(() => {
          setWidth(1920);
          setUnitFromSource('px');
        });
    }
  }, [showOptions, template, templateId, isEditorTemplate, storeExportWidth]);

  useEffect(() => {
    if (showOptions && exportMode === 'batch') {
      loadBatches();
    }
  }, [showOptions, exportMode]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    setExportStep('');
    try {
      const allBatchesResponse = await batchViewService.fetchBatches({
        page: 1,
        pageSize: 100,
        filters: {},
      });
      const loadedBatches = (allBatchesResponse.batches || []).filter((b) => b.status === 'LOADED');
      setBatches(loadedBatches);
      if (loadedBatches.length === 0) {
        const totalBatches = allBatchesResponse.batches?.length || 0;
        if (totalBatches > 0) {
          setExportStep(
            `Found ${totalBatches} batch(es), but none are LOADED. Batches must be fully loaded before export.`
          );
        } else {
          setExportStep('No batches found. Upload a batch first.');
        }
      }
    } catch (error) {
      console.error('[OffscreenExport] Failed to load batches:', error);
      setExportStep(`✗ Failed to load batches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleExport = async () => {
    if (exportMode === 'single') {
      await handleSingleExport();
    } else {
      await handleBatchExport();
    }
  };

  const handleSingleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStep('Starting export...');

    try {
      const exportTemplate_data = template || (await templateService.loadTemplate(templateId!)).data;

      const options: ExportOptions = {
        format,
        quality: format === 'jpg' ? quality : 1.0,
        width,
        backgroundColor: transparentBackground
          ? undefined
          : (exportTemplate_data.backgroundColor || '#ffffff'),
        onProgress: (step, progress) => {
          setExportStep(step);
          setExportProgress(progress);
        },
      };

      const result = await exportTemplate(exportTemplate_data, options);
      const filename = `${templateName.replace(/[^a-z0-9]/gi, '_')}.${result.format}`;
      downloadDataUrl(result.dataUrl, filename);
      const sizeKB = estimateFileSizeKB(result.dataUrl);
      setExportStep(`✓ Exported ${result.width}×${result.height}px (${sizeKB}KB)`);
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

  const handleBatchExport = async () => {
    if (!selectedBatchId) {
      setExportStep('✗ Please select a batch');
      return;
    }
    if (!template && !templateId) {
      setExportStep('✗ No template available');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportStep('Starting batch export...');
    setCancelRequested(false);

    try {
      const exportTemplate_data = template || (await templateService.loadTemplate(templateId!)).data;
      const finalBackgroundColor = transparentBackground
        ? undefined
        : (exportTemplate_data.backgroundColor || '#ffffff');

      const batchExportOptions = {
        format,
        quality: format === 'jpg' ? quality : 1.0,
        width,
        backgroundColor: finalBackgroundColor,
        onProgress: (current: number, total: number, status: string) => {
          setBatchProgress({ current, total });
          setExportStep(status);
          setExportProgress(total > 0 ? current / total : 0);
        },
        onCancel: () => cancelRequested,
      };

      const result = await exportTemplateToBatch(exportTemplate_data, selectedBatchId, batchExportOptions);

      if (result.cancelled) {
        setExportStep(`✗ Export cancelled (${result.successCount}/${result.totalRecords} completed)`);
      } else if (result.zipBlob) {
        const zipFilename = `${result.batchName}_export.zip`;
        downloadZip(result.zipBlob, zipFilename);
        setExportStep(
          `✓ Exported ${result.successCount}/${result.totalRecords} records` +
            (result.failedCount > 0 ? ` (${result.failedCount} failed)` : '')
        );
        setTimeout(() => {
          setShowOptions(false);
          setExportStep('');
          setBatchProgress({ current: 0, total: 0 });
        }, 3000);
      }
    } catch (error) {
      console.error('Batch export failed:', error);
      setExportStep(`✗ Batch export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setCancelRequested(false);
    }
  };

  const handleCancelExport = () => {
    if (isExporting) {
      setShowCancelDialog(true);
    }
  };

  const confirmCancel = (action: 'continue' | 'partial' | 'discard') => {
    if (action === 'continue') {
      setShowCancelDialog(false);
    } else if (action === 'partial' || action === 'discard') {
      setCancelRequested(true);
      setShowCancelDialog(false);
    }
  };

  const templateBg = template?.backgroundColor;
  const aspect = (templateWidth / templateHeight).toFixed(2);

  return (
    <>
      <button
        onClick={() => setShowOptions(true)}
        className={
          className ||
          'rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50'
        }
        disabled={isExporting}
        title="Export template"
      >
        {isExporting ? `${Math.round(exportProgress * 100)}%` : buttonLabel}
      </button>

      {showOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Export Template</h3>
            <p className="text-sm text-gray-600">{templateName}</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">Export Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExportMode('single')}
                    disabled={isExporting}
                    className={`flex-1 rounded px-4 py-2 ${
                      exportMode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                    } disabled:opacity-50`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportMode('batch')}
                    disabled={isExporting}
                    className={`flex-1 rounded px-4 py-2 ${
                      exportMode === 'batch' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                    } disabled:opacity-50`}
                  >
                    Batch
                  </button>
                </div>
              </div>

              {exportMode === 'batch' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">Select Batch</label>
                  {loadingBatches ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
                      <span className="ml-2 text-sm text-gray-600">Loading batches...</span>
                    </div>
                  ) : batches.length === 0 ? (
                    <p className="py-2 text-sm text-gray-500">No batches available</p>
                  ) : (
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      disabled={isExporting}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">-- Select a batch --</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.fileName} ({new Date(batch.createdAt).toLocaleDateString()}) —{' '}
                          {batch.recordsCount || 0} records
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">Format</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat('png')}
                    className={`rounded px-4 py-2 ${
                      format === 'png' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('jpg')}
                    className={`rounded px-4 py-2 ${
                      format === 'jpg' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    JPG
                  </button>
                </div>
              </div>

              <div className="rounded border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-900">Export size (base width)</p>
                <p className="text-xs text-gray-500">
                  Value is in <span className="font-medium text-gray-700">{unitLabel(displayUnit)}</span> (same as Canvas
                  Settings when this template is open). Change the unit in the canvas bar; final output is always
                  pixels.
                </p>
                <div className="mt-2">
                  <input
                    type="number"
                    value={fromPixels(width, displayUnit)}
                    onChange={(e) => onBaseWidthInput(parseFloat(e.target.value) || 0)}
                    disabled={isExporting}
                    className="w-full max-w-xs rounded border border-gray-300 px-2 py-2 text-gray-900"
                    min={0.01}
                    step="any"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-800">
                  <span className="font-semibold">Export: {width}×{calculatedHeight} px</span>
                </p>
                <p className="text-xs text-gray-500">
                  ≈ {fromPixels(width, 'in').toFixed(3)}×{fromPixels(calculatedHeight, 'in').toFixed(3)} in ·{' '}
                  {fromPixels(width, 'cm').toFixed(1)}×{fromPixels(calculatedHeight, 'cm').toFixed(1)} cm (96 px/in)
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-900">Export Dimensions</label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <span className="text-sm text-gray-700">Transparent</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={transparentBackground}
                        onChange={(e) => setTransparentBackground(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
                    </div>
                  </label>
                </div>

                <div
                  className={`mb-3 rounded-lg border p-3 ${
                    transparentBackground ? 'border-gray-300 bg-gray-50' : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold ${
                          transparentBackground ? 'text-gray-700' : 'text-blue-600'
                        }`}
                      >
                        {width}
                      </div>
                      <div className="text-xs text-gray-600">Width (px)</div>
                    </div>
                    <div className="text-2xl text-gray-400">×</div>
                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold ${
                          transparentBackground ? 'text-gray-700' : 'text-blue-600'
                        }`}
                      >
                        {calculatedHeight}
                      </div>
                      <div className="text-xs text-gray-600">Height (px)</div>
                    </div>
                  </div>
                  <div className="mt-2 text-center text-xs text-gray-500">Aspect ratio: {aspect}:1 (canvas)</div>
                  {transparentBackground ? (
                    <div className="mt-1 text-center text-xs text-gray-600">Background: Transparent (PNG)</div>
                  ) : (
                    <div className="mt-1 text-center text-xs text-gray-600">
                      Background: {backgroundLabel(templateBg)}
                    </div>
                  )}
                </div>

                <input
                  type="range"
                  min={100}
                  max={10000}
                  step={10}
                  value={width}
                  onChange={(e) => updateExportWidthPx(Number(e.target.value))}
                  disabled={isExporting}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>100px</span>
                  <span>10000px</span>
                </div>
              </div>

              {format === 'jpg' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Quality: {Math.round(quality * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>10%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {isExporting && (
                <div>
                  <div className="mb-2 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${exportProgress * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{exportStep}</p>
                  {exportMode === 'batch' && batchProgress.total > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Progress: {batchProgress.current}/{batchProgress.total} records
                    </p>
                  )}
                </div>
              )}

              {!isExporting && exportStep && <p className="text-sm text-gray-600">{exportStep}</p>}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || (exportMode === 'batch' && !selectedBatchId)}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isExporting ? 'Exporting…' : exportMode === 'batch' ? 'Export Batch' : 'Export'}
              </button>
              {isExporting && exportMode === 'batch' && (
                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowOptions(false)}
                disabled={isExporting}
                className="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300 disabled:opacity-50"
              >
                {isExporting ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Cancel batch export?</h3>
            <p className="mb-6 text-sm text-gray-600">The batch export is in progress. What do you want to do?</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => confirmCancel('continue')}
                className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Continue export
              </button>
              <button
                type="button"
                onClick={() => confirmCancel('partial')}
                className="w-full rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
              >
                Cancel &amp; download partial ZIP
              </button>
              <button
                type="button"
                onClick={() => confirmCancel('discard')}
                className="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Cancel &amp; discard all
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
