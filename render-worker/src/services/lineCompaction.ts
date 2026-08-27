/**
 * Field resolution + line compaction (server-side port).
 *
 * Parity with the browser batch export
 * (front-cards/features/template-textile/services/fieldResolution.ts and
 * lineCompactionService.ts — keep semantics in sync):
 *
 * Field resolution: tolerant fieldId -> record property, in order:
 *   exact canonical id -> normalized (case/accents/punctuation) ->
 *   `_N` duplicate-suffix strip -> ingest alias table -> null when
 *   unresolvable.
 *
 * Line compaction: lines live inside a `sectionGroup`; `lineGroup` is
 * `type-number` (e.g. "text-1", parsed by LINE_GROUP_REGEX). A line survives
 * iff ANY data-bound element on it has content after the record fill
 * (data-bound = text with `fieldId`, or any element with non-empty
 * `requiredFields`). A line with NO data-bound elements is static and always
 * survives. `requiredFields` on any element of the line is the explicit
 * override: the line exists iff every required field resolves to a non-empty
 * record value (needs the record). Empty lines are removed; surviving lines
 * are physically moved up to fill gaps using the original position map and
 * renumbered. `linePriority` is ignored entirely.
 */

import type { TemplateElementJson } from './fabricTemplateRenderer';
import fieldAliasesSnapshot from '../fixtures/field-aliases.snapshot.json';

/** Every vCard fieldId the designer can drop must resolve to a record property. */
export const FIELD_ID_TO_PROPERTY: Record<string, string> = {
  // Core fields
  full_name: 'fullName',
  first_name: 'firstName',
  last_name: 'lastName',

  // Contact
  work_phone: 'workPhone',
  work_phone_ext: 'workPhoneExt',
  mobile_phone: 'mobilePhone',
  email: 'email',

  // Address
  address_street: 'addressStreet',
  address_city: 'addressCity',
  address_state: 'addressState',
  address_postal: 'addressPostal',
  address_country: 'addressCountry',

  // Social
  social_instagram: 'socialInstagram',
  social_twitter: 'socialTwitter',
  social_facebook: 'socialFacebook',

  // Business
  business_name: 'businessName',
  business_title: 'businessTitle',
  business_department: 'businessDepartment',
  business_url: 'businessUrl',
  business_hours: 'businessHours',

  // Business Address
  business_address_street: 'businessAddressStreet',
  business_address_city: 'businessAddressCity',
  business_address_state: 'businessAddressState',
  business_address_postal: 'businessAddressPostal',
  business_address_country: 'businessAddressCountry',

  // Professional
  business_linkedin: 'businessLinkedin',
  business_twitter: 'businessTwitter',

  // Personal
  personal_url: 'personalUrl',
  personal_bio: 'personalBio',
  personal_birthday: 'personalBirthday',
};

/** Same normalization the ingest parsers apply to headers: trim, lowercase,
 *  strip accents, any non-alphanumeric run becomes `_`. */
export function normalizeFieldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Normalized alias -> canonical fieldId, built from the shared alias
 *  snapshot (packages/shared-types/src/domain/field-aliases.json, duplicated
 *  to src/fixtures/ per repo convention). */
const ALIAS_TO_FIELD_ID: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [fieldId, buckets] of Object.entries(fieldAliasesSnapshot.fields)) {
    map[normalizeFieldKey(fieldId)] = fieldId;
    for (const aliases of Object.values(buckets)) {
      for (const alias of aliases) {
        const key = normalizeFieldKey(alias);
        if (!(key in map)) map[key] = fieldId;
      }
    }
  }
  return map;
})();

/**
 * Resolve an element's fieldId to a record property name, or null when the
 * fieldId cannot correspond to any known record field.
 */
export function resolveRecordProperty(fieldId: string): string | null {
  // 1. Exact canonical id
  const direct = FIELD_ID_TO_PROPERTY[fieldId];
  if (direct) return direct;

  // 2. Normalized (case/accents/punctuation variants: "Mobile Phone", "Móvil")
  const normalized = normalizeFieldKey(fieldId);
  const viaNormalized = FIELD_ID_TO_PROPERTY[normalized];
  if (viaNormalized) return viaNormalized;

  // 3. Duplicate suffix ("work_phone_1") resolves the base field id
  const base = normalized.replace(/_\d+$/, '');
  if (base !== normalized && FIELD_ID_TO_PROPERTY[base]) {
    return FIELD_ID_TO_PROPERTY[base];
  }

  // 4. Ingest alias table ("celular", "portable", "mobile", ...)
  const canonical = ALIAS_TO_FIELD_ID[normalized];
  if (canonical) return FIELD_ID_TO_PROPERTY[canonical] ?? null;

  return null;
}

/**
 * Read the record value for a fieldId. Returns null when the fieldId does not
 * resolve or the record value is null/blank. Final fallback: a record property
 * literally named like the raw fieldId (legacy hand-authored JSON).
 */
export function getRecordFieldValue(
  record: Record<string, unknown>,
  fieldId: string
): string | null {
  const property = resolveRecordProperty(fieldId) ?? (fieldId in record ? fieldId : null);
  if (!property) return null;
  const value = record[property];
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** lineGroup format: "type-number" — dash-free prefix + line index. */
const LINE_GROUP_REGEX = /^(\w+)-(\d+)$/;

/** Minimal record shape needed for requiredFields checks. */
export type CompactionRecord = Record<string, unknown>;

/**
 * Position map structure: sectionGroup -> lineNumber -> elementType -> position
 */
export interface PositionMap {
  [sectionGroup: string]: {
    [lineNumber: number]: {
      [elementType: string]: {
        x: number;
        y: number;
        rotation?: number;
        width?: number;
        height?: number;
      };
    };
  };
}

/**
 * Create original position map ONCE per render, from the template's
 * pre-compaction element positions.
 */
export function createOriginalPositionMap(elements: TemplateElementJson[]): PositionMap {
  const map: PositionMap = {};

  for (const element of elements) {
    // Skip elements not participating in line compaction
    if (!element.sectionGroup || !element.lineGroup) {
      continue;
    }

    const { sectionGroup, lineGroup } = element;

    const match = lineGroup.match(LINE_GROUP_REGEX);
    if (!match) {
      console.warn(`[LineCompaction] Invalid lineGroup format: "${lineGroup}" (expected "type-number", e.g. "text-1")`);
      continue;
    }

    const [, elementType, lineNumberStr] = match;
    const lineNumber = parseInt(lineNumberStr, 10);

    if (!map[sectionGroup]) {
      map[sectionGroup] = {};
    }
    if (!map[sectionGroup][lineNumber]) {
      map[sectionGroup][lineNumber] = {};
    }

    map[sectionGroup][lineNumber][elementType] = {
      x: element.x,
      y: element.y,
      rotation: element.rotation,
      width: element.width,
      height: element.height,
    };
  }

  return map;
}

/** Post-fill content signal for a single element. */
function elementHasOwnContent(element: TemplateElementJson): boolean {
  if (element.type === 'text') {
    const text = element.text?.trim();
    return Boolean(text && text.length > 0);
  }
  if (element.type === 'image') {
    return Boolean(element.imageUrl);
  }
  if (element.type === 'qr') {
    return Boolean(element.data);
  }
  // Shapes and any other types always count as content if present
  return true;
}

/** Data-bound = filled from the record (text with fieldId) or explicitly
 *  gated on record fields (requiredFields). Static elements are not bound. */
function isDataBound(element: TemplateElementJson): boolean {
  if (element.type === 'text' && element.fieldId) return true;
  return Boolean(element.requiredFields && element.requiredFields.length > 0);
}

/**
 * Decide whether a line has content.
 * - requiredFields on any element of the line: explicit gate — the line exists
 *   iff every required field has a value in the record (record required).
 * - otherwise: the line exists iff ANY data-bound element has content; a line
 *   with no data-bound elements at all is static and always exists.
 */
function lineHasContent(
  elements: TemplateElementJson[],
  record?: CompactionRecord
): boolean {
  const requiredFields = Array.from(
    new Set(elements.flatMap((el) => el.requiredFields ?? []))
  );
  if (requiredFields.length > 0 && record) {
    return requiredFields.every((fieldId) => getRecordFieldValue(record, fieldId) !== null);
  }

  const bound = elements.filter(isDataBound);
  if (bound.length === 0) return true; // static line — always kept
  return bound.some(elementHasOwnContent);
}

/** Lines (by number) that have content, in ascending order. */
function determineExistingLines(
  elements: TemplateElementJson[],
  sectionGroup: string,
  record?: CompactionRecord
): number[] {
  const lineElements = new Map<number, TemplateElementJson[]>();

  for (const element of elements) {
    if (element.sectionGroup !== sectionGroup || !element.lineGroup) {
      continue;
    }

    const match = element.lineGroup.match(LINE_GROUP_REGEX);
    if (!match) continue;

    const lineNumber = parseInt(match[2], 10);

    if (!lineElements.has(lineNumber)) {
      lineElements.set(lineNumber, []);
    }
    lineElements.get(lineNumber)!.push(element);
  }

  const existingLines: number[] = [];

  for (const [lineNumber, els] of lineElements) {
    if (lineHasContent(els, record)) {
      existingLines.push(lineNumber);
    }
  }

  return existingLines.sort((a, b) => a - b);
}

export interface RemovedLine {
  sectionGroup: string;
  lineNumber: number;
}

export interface CompactionResult {
  elements: TemplateElementJson[];
  removedLines: RemovedLine[];
}

/**
 * Apply line compaction to an element list.
 *
 * 1. For each section group: determine which lines exist (have content),
 *    REMOVE elements from empty lines, MOVE elements from surviving lines to
 *    fill gaps (using the original position map) and renumber their lineGroup.
 *
 * Pass the current batch record so `requiredFields` gates are evaluated
 * against real data. The input array is not mutated.
 */
export function applyLineCompaction(
  elements: TemplateElementJson[],
  originalPositionMap: PositionMap,
  record?: CompactionRecord
): CompactionResult {
  let compacted = elements.map((el) => ({ ...el }));
  const removedLines: RemovedLine[] = [];

  const sectionGroups = new Set<string>();
  for (const element of compacted) {
    if (element.sectionGroup) {
      sectionGroups.add(element.sectionGroup);
    }
  }

  for (const sectionGroup of sectionGroups) {
    const existingLines = determineExistingLines(compacted, sectionGroup, record);

    if (existingLines.length === 0) {
      // No lines have content - remove entire section
      const sectionLines = new Set<number>();
      for (const element of compacted) {
        if (element.sectionGroup === sectionGroup && element.lineGroup) {
          const match = element.lineGroup.match(LINE_GROUP_REGEX);
          if (match) sectionLines.add(parseInt(match[2], 10));
        }
      }
      for (const lineNumber of sectionLines) {
        removedLines.push({ sectionGroup, lineNumber });
      }
      compacted = compacted.filter((el) => el.sectionGroup !== sectionGroup);
      continue;
    }

    // Find all line numbers in this section
    const allLineNumbers = new Set<number>();
    for (const element of compacted) {
      if (element.sectionGroup === sectionGroup && element.lineGroup) {
        const match = element.lineGroup.match(LINE_GROUP_REGEX);
        if (match) {
          allLineNumbers.add(parseInt(match[2], 10));
        }
      }
    }

    const linesToRemove = Array.from(allLineNumbers).filter((n) => !existingLines.includes(n));

    // STEP 1: REMOVE elements from empty lines
    if (linesToRemove.length > 0) {
      for (const lineNum of linesToRemove) {
        removedLines.push({ sectionGroup, lineNumber: lineNum });
        compacted = compacted.filter((element) => {
          if (element.sectionGroup !== sectionGroup) return true;

          const match = element.lineGroup?.match(LINE_GROUP_REGEX);
          if (!match) return true;

          return parseInt(match[2], 10) !== lineNum;
        });
      }
    }

    // STEP 2: MOVE remaining elements to fill gaps
    let targetPosition = 1;

    for (const sourceLineNumber of existingLines) {
      const elementsToMove = compacted.filter((element) => {
        if (element.sectionGroup !== sectionGroup) return false;

        const match = element.lineGroup?.match(LINE_GROUP_REGEX);
        if (!match) return false;

        return parseInt(match[2], 10) === sourceLineNumber;
      });

      for (const element of elementsToMove) {
        const match = element.lineGroup!.match(LINE_GROUP_REGEX);
        if (!match) continue;

        const elementType = match[1]; // 'icon', 'text', etc.

        const targetPos = originalPositionMap[sectionGroup]?.[targetPosition]?.[elementType];

        if (targetPos) {
          // PHYSICALLY MOVE the element
          element.x = targetPos.x;
          element.y = targetPos.y;

          if (targetPos.rotation !== undefined) {
            element.rotation = targetPos.rotation;
          }

          // Update lineGroup to reflect new position
          element.lineGroup = `${elementType}-${targetPosition}`;
        } else {
          console.warn(`[LineCompaction] No target position for ${elementType}-${targetPosition} in "${sectionGroup}"`);
        }
      }

      targetPosition++;
    }
  }

  return { elements: compacted, removedLines };
}
