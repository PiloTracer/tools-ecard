/**
 * Batch Export Service
 * Export templates with batch record data to PNG files
 */

import JSZip from 'jszip';
import { exportTemplate } from './exportService';
import type { ExportOptions, ExportResult } from './exportService';
import type { Template, TemplateElement, TextElement } from '../types';
import { apiClient } from '@/shared/lib/api-client';

/**
 * Batch record from API (ContactRecordFull type)
 */
export interface BatchRecord {
  batchRecordId: string;
  batchId: string;
  createdAt: Date;
  updatedAt: Date;

  // Core fields
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;

  // Contact
  workPhone: string | null;
  workPhoneExt: string | null;
  mobilePhone: string | null;
  email: string | null;

  // Address
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostal: string | null;
  addressCountry: string | null;

  // Social
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialFacebook: string | null;

  // Business
  businessName: string | null;
  businessTitle: string | null;
  businessDepartment: string | null;
  businessUrl: string | null;
  businessHours: string | null;

  // Business Address
  businessAddressStreet: string | null;
  businessAddressCity: string | null;
  businessAddressState: string | null;
  businessAddressPostal: string | null;
  businessAddressCountry: string | null;

  // Professional
  businessLinkedin: string | null;
  businessTwitter: string | null;

  // Personal
  personalUrl: string | null;
  personalBio: string | null;
  personalBirthday: string | null;
}

/**
 * API response structure
 */
export interface BatchRecordsResponse {
  success: boolean;
  data: {
    batchId: string;
    batchFileName: string;
    batchStatus: string;
    records: BatchRecord[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

/**
 * Batch export options
 */
export interface BatchExportOptions {
  format: 'png' | 'jpg';
  quality?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  onProgress?: (current: number, total: number, status: string) => void;
  onCancel?: () => boolean; // Return true to cancel
}

/**
 * Batch export result
 */
export interface BatchExportResult {
  batchId: string;
  batchName: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  failed: Array<{ recordId: string; error: string }>;
  zipBlob?: Blob;
  cancelled?: boolean;
}

/**
 * Memory limits
 */
const MEMORY_WARNING_THRESHOLD = 1000;
const MEMORY_MAX_LIMIT = 2000;
const CHUNK_SIZE = 100;

/**
 * Fetch all batch records (handles pagination)
 */
export async function fetchBatchRecords(batchId: string): Promise<{ records: BatchRecord[]; batchName: string }> {
  const allRecords: BatchRecord[] = [];
  let page = 1;
  let hasMore = true;
  let batchName = '';

  try {
    while (hasMore) {
      const url = `/api/batches/${batchId}/records?page=${page}&pageSize=500`;
      console.log('[BatchExport] Fetching batch records:', url);

      const data = await apiClient.get<BatchRecordsResponse>(url);
      console.log('[BatchExport] Batch records response:', data);

      if (!data.success || !data.data) {
        throw new Error('Invalid API response format');
      }

      allRecords.push(...data.data.records);
      batchName = data.data.batchFileName;

      // Check if there are more pages
      hasMore = page < data.data.pagination.totalPages;
      page++;

      // Safety check to prevent infinite loops
      if (allRecords.length >= MEMORY_MAX_LIMIT) {
        throw new Error(`Record limit exceeded (max ${MEMORY_MAX_LIMIT} records)`);
      }
    }

    return { records: allRecords, batchName };
  } catch (error) {
    console.error('Error fetching batch records:', error);
    throw error;
  }
}

/**
 * Apply batch record data to template
 * Maps fieldId attributes to record values
 */
export function applyRecordData(template: Template, record: BatchRecord): Template {
  // Deep clone template to avoid mutation
  const clonedTemplate = JSON.parse(JSON.stringify(template)) as Template;

  // Process all elements
  clonedTemplate.elements = clonedTemplate.elements.map((element) => {
    // Only process text elements with fieldId
    if (element.type === 'text') {
      const textElement = element as TextElement;

      if (textElement.fieldId) {
        // Map fieldId to record value
        const fieldValue = (record as any)[textElement.fieldId];

        // Priority: record value > existing text > empty string
        const newText = fieldValue || textElement.text || '';

        return {
          ...textElement,
          text: newText,
        };
      }
    }

    return element;
  });

  return clonedTemplate;
}

/**
 * Sanitize filename to be filesystem-safe
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\s]/g, '_') // Replace special chars
    .replace(/\s+/g, '_')              // Replace spaces with underscores
    .replace(/_+/g, '_')               // Collapse multiple underscores
    .substring(0, 50);                  // Limit length
}

/**
 * Create ZIP archive from export results
 */
export async function createZipArchive(
  exports: Array<{ filename: string; dataUrl: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const total = exports.length;

  for (let i = 0; i < total; i++) {
    const { filename, dataUrl } = exports[i];

    // Extract base64 data from data URL
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) {
      console.warn(`Invalid data URL for ${filename}, skipping`);
      continue;
    }

    // Add to ZIP
    zip.file(filename, base64Data, { base64: true });

    // Progress callback
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  // Generate ZIP blob
  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

/**
 * Export template with batch records
 * Main orchestration function
 */
export async function exportTemplateToBatch(
  template: Template,
  batchId: string,
  options: BatchExportOptions
): Promise<BatchExportResult> {
  const startTime = Date.now();
  const failed: Array<{ recordId: string; error: string }> = [];
  const exports: Array<{ filename: string; dataUrl: string }> = [];

  try {
    // Step 1: Fetch all batch records
    if (options.onProgress) {
      options.onProgress(0, 100, 'Fetching batch records...');
    }

    const { records, batchName } = await fetchBatchRecords(batchId);
    const totalRecords = records.length;

    // Memory warning
    if (totalRecords >= MEMORY_WARNING_THRESHOLD) {
      console.warn(`Large batch detected: ${totalRecords} records. This may take some time.`);
    }

    if (totalRecords === 0) {
      throw new Error('No records found in batch');
    }

    // Step 2: Process records in chunks
    const sanitizedBatchName = sanitizeFilename(batchName.replace(/\.(vcf|csv)$/i, ''));

    for (let i = 0; i < totalRecords; i++) {
      const record = records[i];

      // Check for cancellation
      if (options.onCancel && options.onCancel()) {
        return {
          batchId,
          batchName,
          totalRecords,
          successCount: exports.length,
          failedCount: failed.length,
          failed,
          cancelled: true,
        };
      }

      try {
        // Apply record data to template
        const populatedTemplate = applyRecordData(template, record);

        // Export to PNG
        const result: ExportResult = await exportTemplate(populatedTemplate, {
          format: options.format || 'png',
          quality: options.quality,
          width: options.width,
          height: options.height,
          backgroundColor: options.backgroundColor,
        });

        // Generate filename: batchName_001_John_Doe.png
        const fullName = record.fullName || 'Unnamed';
        const sanitizedName = sanitizeFilename(fullName);
        const index = String(i + 1).padStart(3, '0');
        const filename = `${sanitizedBatchName}_${index}_${sanitizedName}.${result.format}`;

        exports.push({
          filename,
          dataUrl: result.dataUrl,
        });

        // Progress update
        const progress = Math.round(((i + 1) / totalRecords) * 90); // Reserve 10% for ZIP creation
        if (options.onProgress) {
          options.onProgress(
            i + 1,
            totalRecords,
            `Exporting ${i + 1}/${totalRecords}: ${fullName}`
          );
        }
      } catch (error) {
        console.error(`Failed to export record ${record.batchRecordId}:`, error);
        failed.push({
          recordId: record.batchRecordId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Memory management: Force garbage collection hints every chunk
      if ((i + 1) % CHUNK_SIZE === 0) {
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield to event loop
      }
    }

    // Step 3: Create ZIP archive
    if (options.onProgress) {
      options.onProgress(totalRecords, totalRecords, 'Creating ZIP archive...');
    }

    const zipBlob = await createZipArchive(exports, (current, total) => {
      const progress = 90 + Math.round((current / total) * 10);
      if (options.onProgress) {
        options.onProgress(totalRecords, totalRecords, `Creating ZIP (${current}/${total})...`);
      }
    });

    // Done
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Batch export completed in ${duration}s: ${exports.length} succeeded, ${failed.length} failed`);

    return {
      batchId,
      batchName,
      totalRecords,
      successCount: exports.length,
      failedCount: failed.length,
      failed,
      zipBlob,
    };
  } catch (error) {
    console.error('Batch export failed:', error);
    throw error;
  }
}

/**
 * Download ZIP file
 */
export function downloadZip(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
