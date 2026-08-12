import { prisma } from '../../../core/prisma/client';
import { BatchStatus, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BatchImportRequest,
  BatchImportResponse,
  BatchImportError,
  ParsedRecord,
  ImportError,
  FieldMapping,
  ColumnAnalysis,
  FieldMappingPresetDto,
  InspectColumnsResult,
} from '../types';
import { batchParsingService } from '../../batch-parsing/services/batchParsingService';
import {
  computeMappingSignature,
  getCanonicalTargetFields,
  validateFieldMappings,
} from './fieldMapping';

// Common field name patterns for auto-detection
const FIELD_PATTERNS: Record<string, string[]> = {
  fullName: ['full name', 'name', 'fullname', 'complete name'],
  workPhone: ['work phone', 'workphone', 'phone', 'telephone', 'tel', 'business phone'],
  mobilePhone: ['mobile phone', 'mobile', 'cell', 'cellphone', 'mobilephone'],
  email: ['email', 'e-mail', 'mail', 'email address', 'emailaddress'],
  businessName: ['business name', 'businessname', 'company', 'organization', 'organisation', 'org'],
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Batch Import Service
 *
 * Imports batch records by applying field mappings to the existing
 * parsed records in the BatchRecord table.
 */
export class BatchImportService {
  /**
   * Import a batch — process records through field mappings
   */
  async importBatch(request: BatchImportRequest): Promise<BatchImportResponse> {
    const { batchId, mappings } = request;

    // Fetch batch to verify it exists and is in parsable state
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, status: true, fileName: true },
    });

    if (!batch) {
      throw new BatchImportError('Batch not found', 'NOT_FOUND', 404);
    }

    if (batch.status !== 'PARSED') {
      throw new BatchImportError(
        `Batch is in status "${batch.status}". Must be PARSED before import.`,
        'INVALID_STATUS',
        400
      );
    }

    // Fetch parsed records
    const records = await prisma.batchRecord.findMany({
      where: { batchId },
      select: { id: true, fullName: true, workPhone: true, mobilePhone: true, email: true, businessName: true },
    });

    if (records.length === 0) {
      return {
        batchId,
        recordsProcessed: 0,
        recordsImported: 0,
        recordsFailed: 0,
      };
    }

    // Apply field mappings to each record
    const errors: ImportError[] = [];
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const validationErrors = this.validateRecord(record, i);

      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        failed++;
        continue;
      }

      // If mappings provided, map source values to target fields
      if (mappings && mappings.length > 0) {
        const mapped = this.applyMappingsToRecord(record, mappings);
        await prisma.batchRecord.update({
          where: { id: record.id },
          data: mapped,
        });
      }

      imported++;
    }

    // Update batch status to indicate import is complete
    await prisma.batch.update({
      where: { id: batchId },
      data: { status: 'PARSED' as BatchStatus }, // Keep as PARSED; import is a sub-step
    });

    return {
      batchId,
      recordsProcessed: records.length,
      recordsImported: imported,
      recordsFailed: failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Parse a single record into standardized fields
   */
  async parseRecord(
    record: Record<string, any>,
    mappings?: FieldMapping[]
  ): Promise<ParsedRecord> {
    const mapped = mappings
      ? this.applyMappings(record, mappings)
      : record;

    // Detect fullName from given+family if available
    const fullName = mapped.fullName ||
      [mapped.givenName, mapped.familyName].filter(Boolean).join(' ') ||
      '';

    return {
      fullName,
      workPhone: mapped.workPhone || mapped.phone || '',
      mobilePhone: mapped.mobilePhone || mapped.mobile || '',
      email: mapped.email || '',
      businessName: mapped.businessName || mapped.organization || mapped.company || '',
    };
  }

  /**
   * Validate records
   */
  async validateRecords(records: ParsedRecord[]): Promise<ImportError[]> {
    const errors: ImportError[] = [];
    for (let i = 0; i < records.length; i++) {
      const recordErrors = this.validateRecordData(records[i], i);
      errors.push(...recordErrors);
    }
    return errors;
  }

  /**
   * Get import preview — return parsed records from DB
   */
  async getImportPreview(
    batchId: string,
    limit: number = 5
  ): Promise<ParsedRecord[]> {
    const records = await prisma.batchRecord.findMany({
      where: { batchId },
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: { fullName: true, workPhone: true, mobilePhone: true, email: true, businessName: true },
    });

    return records.map((r) => ({
      fullName: r.fullName || '',
      workPhone: r.workPhone || '',
      mobilePhone: r.mobilePhone || '',
      email: r.email || '',
      businessName: r.businessName || '',
    }));
  }

  /**
   * Get field mapping suggestions by analyzing field name patterns
   */
  async getFieldMappingSuggestions(_batchId: string): Promise<any[]> {
    // Return default suggestions based on known field patterns
    // In a full implementation, this would analyze CSV headers
    return [
      { sourceColumn: 'Name', targetField: 'fullName', confidence: 0.95 },
      { sourceColumn: 'Email', targetField: 'email', confidence: 0.98 },
      { sourceColumn: 'Work Phone', targetField: 'workPhone', confidence: 0.90 },
      { sourceColumn: 'Mobile Phone', targetField: 'mobilePhone', confidence: 0.90 },
      { sourceColumn: 'Business', targetField: 'businessName', confidence: 0.85 },
    ];
  }

  // --- Pass 3: preview (column inspection) + saved mapping presets ---

  /**
   * Inspect an uploaded file's columns via the Python parser's --inspect mode:
   * per-column auto-mapping (alias/canonical/fuzzy/none) + sample values, plus
   * the canonical target-field list and a suggested preset when the file's
   * header signature matches one the user saved before.
   */
  async previewFile(
    userId: string,
    fileName: string,
    buffer: Buffer
  ): Promise<{
    fileName: string;
    rowsTotal: number;
    columns: ColumnAnalysis[];
    targetFields: ReturnType<typeof getCanonicalTargetFields>;
    suggestedPreset: FieldMappingPresetDto | null;
  }> {
    const ext = path.extname(fileName || '').toLowerCase() || '.csv';
    const tempPath = path.join(
      os.tmpdir(),
      `inspect-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
    );

    let inspect: InspectColumnsResult;
    try {
      await fs.promises.writeFile(tempPath, buffer);
      inspect = (await batchParsingService.inspectFile(tempPath)) as unknown as InspectColumnsResult;
    } finally {
      await fs.promises.unlink(tempPath).catch(() => undefined);
    }

    if (!inspect.success || !inspect.columns) {
      throw new BatchImportError(
        inspect.error || 'Could not analyze the file',
        'INSPECT_FAILED',
        400
      );
    }

    const columns: ColumnAnalysis[] = inspect.columns.map((c) => ({
      sourceColumn: c.source_column,
      autoField: c.auto_field,
      confidence: c.confidence,
      sampleValues: c.sample_values,
    }));

    const signature = computeMappingSignature(columns.map((c) => c.sourceColumn));
    const preset = await prisma.fieldMappingPreset.findFirst({
      where: { userId, signature },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      fileName: inspect.file || fileName,
      rowsTotal: inspect.rows_total ?? 0,
      columns,
      targetFields: getCanonicalTargetFields(),
      suggestedPreset: preset ? this.toPresetDto(preset) : null,
    };
  }

  /** List the caller's saved mapping presets (strictly per-user). */
  async listPresets(userId: string): Promise<FieldMappingPresetDto[]> {
    const presets = await prisma.fieldMappingPreset.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return presets.map((p) => this.toPresetDto(p));
  }

  /**
   * Save a mapping preset. The signature is computed server-side from the
   * mapping's source columns so it always matches the preview/upload lookup.
   */
  async createPreset(
    userId: string,
    name: string,
    mappingInput: unknown
  ): Promise<FieldMappingPresetDto> {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new BatchImportError('Preset name is required', 'VALIDATION_ERROR', 400);
    }
    const mappings = validateFieldMappings(mappingInput);
    if (mappings.length === 0) {
      throw new BatchImportError('Preset mapping must not be empty', 'VALIDATION_ERROR', 400);
    }
    const signature = computeMappingSignature(mappings.map((m) => m.sourceColumn));
    const preset = await prisma.fieldMappingPreset.create({
      data: {
        userId,
        name: trimmedName.slice(0, 120),
        signature,
        mapping: mappings as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toPresetDto(preset);
  }

  /** Delete one of the caller's presets (404 when owned by someone else). */
  async deletePreset(userId: string, presetId: string): Promise<void> {
    const result = await prisma.fieldMappingPreset.deleteMany({
      where: { id: presetId, userId },
    });
    if (result.count === 0) {
      throw new BatchImportError('Preset not found', 'NOT_FOUND', 404);
    }
  }

  private toPresetDto(preset: {
    id: string;
    name: string;
    signature: string;
    mapping: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): FieldMappingPresetDto {
    return {
      id: preset.id,
      name: preset.name,
      signature: preset.signature,
      mapping: (preset.mapping as FieldMapping[]) ?? [],
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    };
  }

  // --- Private helpers ---

  private applyMappingsToRecord(
    record: { fullName: string | null; workPhone: string | null; mobilePhone: string | null; email: string | null; businessName: string | null },
    mappings: FieldMapping[]
  ): Record<string, any> {
    const update: Record<string, any> = {};
    // Build a lookup of DB field names to values
    const recordMap: Record<string, string | null> = {
      fullName: record.fullName,
      workPhone: record.workPhone,
      mobilePhone: record.mobilePhone,
      email: record.email,
      businessName: record.businessName,
    };

    for (const mapping of mappings) {
      // In the import context, sourceColumn is the DB field name
      const sourceValue = recordMap[mapping.sourceColumn];
      if (sourceValue !== undefined && sourceValue !== null) {
        update[mapping.targetField] = sourceValue;
      }
    }

    return update;
  }

  private applyMappings(
    record: Record<string, any>,
    mappings: FieldMapping[]
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const mapping of mappings) {
      if (mapping.sourceColumn in record) {
        result[mapping.targetField] = record[mapping.sourceColumn];
      }
    }
    return result;
  }

  private validateRecord(
    record: { email: string | null },
    rowIndex: number
  ): ImportError[] {
    const errors: ImportError[] = [];
    if (record.email && !EMAIL_REGEX.test(record.email)) {
      errors.push({
        row: rowIndex,
        field: 'email',
        value: record.email,
        message: 'Invalid email format',
      });
    }
    return errors;
  }

  private validateRecordData(
    data: Record<string, any>,
    rowIndex: number
  ): ImportError[] {
    const errors: ImportError[] = [];
    if (data.email && !EMAIL_REGEX.test(String(data.email))) {
      errors.push({
        row: rowIndex,
        field: 'email',
        value: String(data.email),
        message: 'Invalid email format',
      });
    }
    return errors;
  }
}

// Export singleton instance
export const batchImportService = new BatchImportService();
