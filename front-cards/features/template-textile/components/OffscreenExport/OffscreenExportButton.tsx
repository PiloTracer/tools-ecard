/**
 * Offscreen Export Button
 * Export templates without opening them using off-screen canvas rendering
 * Supports both single template export and batch export with record data
 */

'use client';

import { useState, useEffect } from 'react';
import { exportTemplateById, exportTemplate, downloadDataUrl, estimateFileSizeKB } from '../../services/exportService';
import { templateService } from '../../services/templateService';
import { exportTemplateToBatch, downloadZip } from '../../services/batchExportService';
import type { ExportOptions } from '../../services/exportService';
import type { Template } from '../../types';
import type { Batch } from '@/features/batch-view/types';
import { batchViewService } from '@/features/batch-view/services/batchViewService';

interface OffscreenExportButtonProps {
  templateId?: string;      // For loading from storage
  template?: Template;      // For exporting already-loaded template (skips storage load)
  templateName: string;
  className?: string;
  buttonLabel?: string; // Custom button label (default: "Export")
}

export function OffscreenExportButton({ templateId, template, templateName, className, buttonLabel = 'Export' }: OffscreenExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStep, setExportStep] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  // Export mode: 'single' or 'batch'
  const [exportMode, setExportMode] = useState<'single' | 'batch'>('single');

  // Batch selection
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Batch export progress
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Cancellation
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  // Template dimensions for aspect ratio calculation
  const [templateWidth, setTemplateWidth] = useState(1200);
  const [templateHeight, setTemplateHeight] = useState(600);

  // Export options
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [quality, setQuality] = useState(0.9);
  const [width, setWidth] = useState(2400);
  const [transparentBackground, setTransparentBackground] = useState(false);

  // Calculate height based on aspect ratio
  const calculatedHeight = Math.round(width * templateHeight / templateWidth);

  // Load template dimensions when modal opens
  useEffect(() => {
    if (showOptions) {
      if (template) {
        // Use provided template object (already loaded)
        setTemplateWidth(template.width || template.canvasWidth || 1200);
        setTemplateHeight(template.height || template.canvasHeight || 600);
      } else if (templateId) {
        // Load from storage
        templateService.loadTemplate(templateId).then(loaded => {
          setTemplateWidth(loaded.data.width || loaded.data.canvasWidth || 1200);
          setTemplateHeight(loaded.data.height || loaded.data.canvasHeight || 600);
        }).catch(err => {
          console.error('Failed to load template dimensions:', err);
        });
      }
    }
  }, [showOptions, templateId, template]);

  // Load batches when modal opens in batch mode
  useEffect(() => {
    if (showOptions && exportMode === 'batch') {
      loadBatches();
    }
  }, [showOptions, exportMode]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    setExportStep('');
    try {
      // Load all batches to see what's available
      console.log('[OffscreenExport] Loading ALL batches (no filter)...');
      const allBatchesResponse = await batchViewService.fetchBatches({
        page: 1,
        pageSize: 100,
        filters: {}
      });
      console.log('[OffscreenExport] All batches response:', allBatchesResponse);
      console.log('[OffscreenExport] Total batches found:', allBatchesResponse.batches?.length || 0);

      if (allBatchesResponse.batches && allBatchesResponse.batches.length > 0) {
        console.log('[OffscreenExport] Batch statuses:', allBatchesResponse.batches.map(b => ({
          fileName: b.fileName,
          status: b.status,
          recordsCount: b.recordsCount
        })));
      }

      // Filter to only LOADED batches (final successful status with parsed records)
      console.log('[OffscreenExport] Filtering for LOADED batches...');
      const loadedBatches = (allBatchesResponse.batches || []).filter(b => b.status === 'LOADED');
      console.log('[OffscreenExport] LOADED batches:', loadedBatches.length);

      setBatches(loadedBatches);

      if (loadedBatches.length === 0) {
        const totalBatches = allBatchesResponse.batches?.length || 0;
        if (totalBatches > 0) {
          setExportStep(`Found ${totalBatches} batch(es), but none are LOADED. Batches must be fully loaded before export.`);
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
      // Get template data
      const exportTemplate_data = template || (await templateService.loadTemplate(templateId!)).data;

      const options: ExportOptions = {
        format,
        quality: format === 'jpg' ? quality : 1.0,
        width,
        backgroundColor: transparentBackground ? undefined : (exportTemplate_data.backgroundColor || '#ffffff'),
        onProgress: (step, progress) => {
          setExportStep(step);
          setExportProgress(progress);
        }
      };

      // Export
      const result = await exportTemplate(exportTemplate_data, options);

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
      // Get template
      const exportTemplate_data = template || (await templateService.loadTemplate(templateId!)).data;

      // CRITICAL: Use template's backgroundColor, not hardcoded 'white'
      const finalBackgroundColor = transparentBackground ? undefined : (exportTemplate_data.backgroundColor || '#ffffff');

      const batchExportOptions = {
        format,
        quality: format === 'jpg' ? quality : 1.0,
        width,
        backgroundColor: finalBackgroundColor,
        onProgress: (current: number, total: number, status: string) => {
          setBatchProgress({ current, total });
          setExportStep(status);
          setExportProgress(current / total);
        },
        onCancel: () => cancelRequested,
      };

      console.log('[OffscreenExport] Batch export options:', {
        transparentBackground,
        templateBackgroundColor: exportTemplate_data.backgroundColor,
        finalBackgroundColor: finalBackgroundColor,
        willBeUsed: finalBackgroundColor
      });

      // Export with batch data
      const result = await exportTemplateToBatch(exportTemplate_data, selectedBatchId, batchExportOptions);

      if (result.cancelled) {
        setExportStep(`✗ Export cancelled (${result.successCount}/${result.totalRecords} completed)`);
      } else {
        // Download ZIP file
        if (result.zipBlob) {
          const zipFilename = `${result.batchName}_export.zip`;
          downloadZip(result.zipBlob, zipFilename);

          // Show success message
          setExportStep(
            `✓ Exported ${result.successCount}/${result.totalRecords} records` +
            (result.failedCount > 0 ? ` (${result.failedCount} failed)` : '')
          );

          // Close modal after delay
          setTimeout(() => {
            setShowOptions(false);
            setExportStep('');
            setBatchProgress({ current: 0, total: 0 });
          }, 3000);
        }
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

  return (
    <>
      <button
        onClick={() => setShowOptions(true)}
        className={className || 'px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm'}
        disabled={isExporting}
        title="Export template"
      >
        {isExporting ? `${Math.round(exportProgress * 100)}%` : buttonLabel}
      </button>

      {showOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Template</h3>
            <p className="text-sm text-gray-600 mb-4">{templateName}</p>

            <div className="space-y-4">
              {/* Export Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Export Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportMode('single')}
                    disabled={isExporting}
                    className={`flex-1 px-4 py-2 rounded ${exportMode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} disabled:opacity-50`}
                  >
                    Single
                  </button>
                  <button
                    onClick={() => setExportMode('batch')}
                    disabled={isExporting}
                    className={`flex-1 px-4 py-2 rounded ${exportMode === 'batch' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'} disabled:opacity-50`}
                  >
                    Batch
                  </button>
                </div>
              </div>

              {/* Batch Selection (only in batch mode) */}
              {exportMode === 'batch' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Select Batch</label>
                  {loadingBatches ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Loading batches...</span>
                    </div>
                  ) : batches.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No batches available</p>
                  ) : (
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      disabled={isExporting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">-- Select a batch --</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.fileName} ({new Date(batch.createdAt).toLocaleDateString()}) - {batch.recordsCount || 0} records
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormat('png')}
                    className={`px-4 py-2 rounded ${format === 'png' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'}`}
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => setFormat('jpg')}
                    className={`px-4 py-2 rounded ${format === 'jpg' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'}`}
                  >
                    JPG
                  </button>
                </div>
              </div>

              {/* Export Dimensions and Transparency */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-900">Export Dimensions</label>

                  {/* Transparency Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-700">Transparent</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={transparentBackground}
                        onChange={(e) => setTransparentBackground(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </div>
                  </label>
                </div>

                {/* Dimensions Display */}
                <div className={`border rounded-lg p-3 mb-3 ${transparentBackground ? 'bg-gray-50 border-gray-300' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${transparentBackground ? 'text-gray-700' : 'text-blue-600'}`}>{width}</div>
                      <div className="text-xs text-gray-600">Width (px)</div>
                    </div>
                    <div className="text-gray-400 text-2xl">×</div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${transparentBackground ? 'text-gray-700' : 'text-blue-600'}`}>{calculatedHeight}</div>
                      <div className="text-xs text-gray-600">Height (px)</div>
                    </div>
                  </div>
                  <div className="text-center text-xs text-gray-500 mt-2">
                    Aspect ratio: {(templateWidth / templateHeight).toFixed(2)}:1
                  </div>
                  {!transparentBackground && (
                    <div className="text-center text-xs text-gray-600 mt-1">
                      Background: White
                    </div>
                  )}
                  {transparentBackground && (
                    <div className="text-center text-xs text-gray-600 mt-1">
                      Background: Transparent
                    </div>
                  )}
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
                  <label className="block text-sm font-medium text-gray-900 mb-2">
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
                  {exportMode === 'batch' && batchProgress.total > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Progress: {batchProgress.current}/{batchProgress.total} records
                    </p>
                  )}
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
                disabled={isExporting || (exportMode === 'batch' && !selectedBatchId)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : exportMode === 'batch' ? 'Export Batch' : 'Export'}
              </button>
              {isExporting && exportMode === 'batch' && (
                <button
                  onClick={handleCancelExport}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => setShowOptions(false)}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                {isExporting ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Batch Export?</h3>
            <p className="text-sm text-gray-600 mb-6">
              The batch export is in progress. What would you like to do?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => confirmCancel('continue')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Continue Export
              </button>
              <button
                onClick={() => confirmCancel('partial')}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Cancel & Download Partial ZIP
              </button>
              <button
                onClick={() => confirmCancel('discard')}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Cancel & Discard All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
