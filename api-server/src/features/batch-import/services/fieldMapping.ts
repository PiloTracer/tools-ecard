/**
 * Field-mapping helpers (Pass 3): canonical header normalization, preset
 * signatures, and mapping validation shared by the batch-import preview/preset
 * routes and the batch-upload mapping override.
 *
 * The normalization mirrors data_normalizer.py `_canonical_header_key` (and the
 * demo parser's normalizeHeaderKey) so a header matches its mapping regardless
 * of case/accents/separators.
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveBatchParsingPath } from '../../batch-parsing/services/batchParsingService';
import type { FieldMapping } from '../types';

/** Explicit-mapping target that sends a column to the record's `extra` verbatim. */
export const IGNORE_TARGET = 'ignore';

export interface CanonicalTargetField {
  id: string;
  labelEn: string;
  labelEs: string;
  category: string;
}

/** Lowercase, accent-stripped, every non-alphanumeric run collapsed to `_`. */
export function normalizeHeaderKey(raw: string): string {
  return String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Stable hash of the sorted normalized header list (FNV-1a 32-bit). Used to
 * auto-suggest a saved preset when the same columns are seen again. The demo
 * client mirrors this exact algorithm for its localStorage presets.
 */
export function computeMappingSignature(headers: string[]): string {
  const input = headers.map(normalizeHeaderKey).filter(Boolean).sort().join('\n');
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

let cachedTargetFields: CanonicalTargetField[] | null = null;

/** Valid mapping targets: the canonical 30-field list snapshot (labels included
 *  so the preview response can feed the mapping modal dropdowns directly). */
export function getCanonicalTargetFields(): CanonicalTargetField[] {
  if (!cachedTargetFields) {
    const snapshotPath = resolveBatchParsingPath(
      path.join('fixtures', 'vcard-fields.snapshot.json')
    );
    cachedTargetFields = JSON.parse(
      fs.readFileSync(snapshotPath, 'utf-8')
    ) as CanonicalTargetField[];
  }
  return cachedTargetFields;
}

export class FieldMappingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldMappingValidationError';
  }
}

/**
 * Validate a user-supplied mapping (unknown shape in, typed FieldMapping[] out).
 * Unknown target fields are a hard error listing the valid ids — never guess.
 */
export function validateFieldMappings(input: unknown): FieldMapping[] {
  if (!Array.isArray(input)) {
    throw new FieldMappingValidationError('mapping must be a list of { sourceColumn, targetField }');
  }
  const validTargets = new Set([...getCanonicalTargetFields().map((f) => f.id), IGNORE_TARGET]);
  const mappings: FieldMapping[] = [];
  for (const entry of input) {
    const sourceColumn = String((entry as FieldMapping)?.sourceColumn ?? '').trim();
    const targetField = String((entry as FieldMapping)?.targetField ?? '').trim();
    if (!sourceColumn || !targetField) {
      throw new FieldMappingValidationError(
        'Each mapping entry needs sourceColumn and targetField'
      );
    }
    if (!validTargets.has(targetField)) {
      throw new FieldMappingValidationError(
        `Unknown targetField '${targetField}'. Valid targets: ${[...validTargets].sort().join(', ')}`
      );
    }
    mappings.push({ sourceColumn, targetField });
  }
  return mappings;
}

/** Convert to the snake_case payload the Python parser's --mapping file expects. */
export function toPythonMappingPayload(mappings: FieldMapping[]): string {
  return JSON.stringify({
    mappings: mappings.map((m) => ({
      source_column: m.sourceColumn,
      target_field: m.targetField,
    })),
  });
}
