/**
 * Demo-mode spreadsheet parser.
 * CSV/TXT via text; XLSX via JSZip + worksheet XML (no server / no new deps).
 */

import JSZip from 'jszip';
import { decodeXmlEntities } from '../../shared/lib/decodeXmlEntities';
import { capitalizeName, DEMO_PERSON_NAME_KEYS } from './nameCapitalize';
import { snakeToCamel, camelToSnake } from '../batch-upload/utils/mappingSignature';
import fieldAliasesSnapshot from './fixtures/field-aliases.snapshot.json';

export type DemoParsedTable = {
  headers: string[];
  rows: string[][];
};

/** Contact-shaped fields stored on demo batch records */
export type DemoContactFields = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  workPhone?: string | null;
  workPhoneExt?: string | null;
  mobilePhone?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostal?: string | null;
  addressCountry?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialFacebook?: string | null;
  businessName?: string | null;
  businessTitle?: string | null;
  businessDepartment?: string | null;
  businessUrl?: string | null;
  businessHours?: string | null;
  businessAddressStreet?: string | null;
  businessAddressCity?: string | null;
  businessAddressState?: string | null;
  businessAddressPostal?: string | null;
  businessAddressCountry?: string | null;
  businessLinkedin?: string | null;
  businessTwitter?: string | null;
  personalUrl?: string | null;
  personalBio?: string | null;
  personalBirthday?: string | null;
};

/**
 * Header aliases — built from the per-language snapshot
 * (packages/shared-types/src/domain/field-aliases.json, duplicated to fixtures/ per
 * repo convention). Keys are canonical-normalized; lookup merges all language buckets.
 * Extending to a new language = adding a bucket in the JSON — no parser change.
 * Parity with the Python parser's FIELD_MAPPING is enforced by fieldAliasesParity.test.ts
 * and api-server/batch-parsing/test_batch_parsing.py.
 */
function buildHeaderAliases(): Record<string, keyof DemoContactFields> {
  const map: Record<string, keyof DemoContactFields> = {};
  for (const [fieldId, buckets] of Object.entries(fieldAliasesSnapshot.fields)) {
    const target = snakeToCamel(fieldId) as keyof DemoContactFields;
    // The canonical id itself always resolves (e.g. "work_phone").
    map[normalizeHeaderKey(fieldId)] = target;
    for (const aliases of Object.values(buckets)) {
      for (const alias of aliases) {
        const key = normalizeHeaderKey(alias);
        if (!(key in map)) map[key] = target;
      }
    }
  }
  return map;
}

export const HEADER_ALIASES: Record<string, keyof DemoContactFields> = buildHeaderAliases();

/** Minimum alias length considered for substring (fuzzy) header matching — keeps short
 *  aliases like "ext"/"url"/"tel" restricted to exact-token matches only, avoiding false
 *  positives on unrelated headers that merely contain those letters. */
const FUZZY_MIN_ALIAS_LEN = 4;

/**
 * Fuzzy fallback for headers that don't exactly match a known alias — e.g. "Teléfono
 * Oficina 2", "Cel./WhatsApp", "Correo Electrónico Personal". Splits the normalized key
 * into tokens. A token that IS a known alias (correo, email, telefono, direccion…)
 * states the column's meaning outright — it wins over substring noise from filler
 * tokens (trabajo, oficina, personal), so "Correo Trabajo" resolves to email. Two or
 * more distinct strong hits mean a genuinely compound header ("Nombre y Apellido") →
 * null, so the caller's positional/name fallback handles it instead of guessing.
 * Without any strong hit, longer tokens try substring containment against known alias
 * keywords; ambiguity likewise returns null.
 */
function findFuzzyFieldMatch(normalizedKey: string): keyof DemoContactFields | null {
  const tokens = normalizedKey.split('_').filter(Boolean);
  const matchedFields = new Set<keyof DemoContactFields>();

  // Strong-signal pass: exact-token alias hits only.
  for (const token of tokens) {
    const direct = HEADER_ALIASES[token];
    if (direct) matchedFields.add(direct);
  }
  if (matchedFields.size === 1) return [...matchedFields][0];
  if (matchedFields.size > 1) return null;

  for (const token of tokens) {
    // Below the length floor, only the exact-token pass (above) counts — a short
    // token like "de" would otherwise substring-match into unrelated long
    // aliases (e.g. "de" is contained in "department"/"departamento").
    if (token.length < FUZZY_MIN_ALIAS_LEN) continue;
    for (const aliasKey of HEADER_KEYWORDS) {
      if (aliasKey.length < FUZZY_MIN_ALIAS_LEN) continue;
      if (token.includes(aliasKey) || aliasKey.includes(token)) {
        matchedFields.add(HEADER_ALIASES[aliasKey]);
      }
    }
  }

  return matchedFields.size === 1 ? [...matchedFields][0] : null;
}

function digitsOnly(value?: string | null): string {
  return (value || '').replace(/\D/g, '');
}

/** Value looks like a short extension rather than a full phone number. */
function looksLikeExtension(value?: string | null): boolean {
  if (!value || value.trim().startsWith('+')) return false;
  const digits = digitsOnly(value);
  return digits.length > 0 && digits.length <= 5;
}

/** Value looks like a full phone number rather than a short extension. */
function looksLikePhoneNumber(value?: string | null): boolean {
  if (!value) return false;
  if (value.trim().startsWith('+')) return true;
  return digitsOnly(value).length >= 7;
}

/**
 * Some sheets label columns "Teléfono"/"Extensión" but the VALUES are swapped — a full
 * number sits under "Ext" and a 2-4 digit extension sits under "Teléfono". Header-based
 * mapping alone can't catch this (both headers matched correctly); reclassify by value
 * shape afterward. Conservative on purpose: only acts on clearly short (<=5 digit) vs
 * clearly long (>=7 digit, or E.164 "+...") values, leaves the ambiguous middle alone.
 */
function reconcilePhoneAndExtension(fields: DemoContactFields): void {
  const phone = fields.workPhone;
  const ext = fields.workPhoneExt;
  const phoneIsExtShaped = looksLikeExtension(phone);
  const extIsPhoneShaped = looksLikePhoneNumber(ext);

  if (phoneIsExtShaped && extIsPhoneShaped) {
    fields.workPhone = ext;
    fields.workPhoneExt = phone;
  } else if (phoneIsExtShaped && !ext) {
    fields.workPhoneExt = phone;
    delete fields.workPhone;
  } else if (extIsPhoneShaped && !phone) {
    fields.workPhone = ext;
    delete fields.workPhoneExt;
  }
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

const HEADER_KEYWORDS = Object.keys(HEADER_ALIASES);

/**
 * Score a row as a header candidate (mirrors api-server FileParser.find_header_row).
 */
export function headerRowMatchScore(row: string[]): number {
  let matches = 0;
  for (const cell of row) {
    const key = normalizeHeaderKey(cell);
    if (!key) continue;
    if (HEADER_ALIASES[key]) {
      matches += 2;
      continue;
    }
    if (HEADER_KEYWORDS.some((kw) => key.includes(kw) || kw.includes(key))) {
      matches += 1;
    }
  }
  return matches;
}

/** Pick best header row in the first 20 rows; 0 if none confidently match. */
export function findHeaderRowIndex(matrix: string[][]): number {
  let bestIdx = 0;
  let bestScore = 0;
  const limit = Math.min(20, matrix.length);
  for (let i = 0; i < limit; i++) {
    const score = headerRowMatchScore(matrix[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore > 0 ? bestIdx : 0;
}

/**
 * Count cells that look like known field headers (mirrors api-server
 * FileParser._header_match_count): exact alias hit or substring containment
 * against any known header keyword.
 */
function headerMatchCount(cells: string[]): number {
  let count = 0;
  for (const cell of cells) {
    const key = normalizeHeaderKey(cell);
    if (!key) continue;
    if (
      HEADER_ALIASES[key] ||
      HEADER_KEYWORDS.some((kw) => key.includes(kw) || kw.includes(key))
    ) {
      count += 1;
    }
  }
  return count;
}

/** Minimum column-A header hits before a sheet is treated as transposed. */
const TRANSPOSED_MIN_MATCHES = 3;

/**
 * Detect a transposed layout: headers down column A, one contact per column
 * B+ (mirrors api-server FileParser._is_transposed_matrix). Chosen only on a
 * clear margin — column A must score at least TRANSPOSED_MIN_MATCHES header
 * hits AND strictly more than the best horizontal row; ambiguous sheets keep
 * the status-quo horizontal parsing.
 */
export function isTransposedMatrix(matrix: string[][]): boolean {
  if (matrix.length === 0) return false;
  const width = Math.max(...matrix.map((r) => r.length));
  if (width < 2) return false;
  const limit = Math.min(20, matrix.length);
  let horizontal = 0;
  const columnA: string[] = [];
  for (let r = 0; r < limit; r++) {
    horizontal = Math.max(horizontal, headerMatchCount(matrix[r] || []));
    columnA.push(matrix[r]?.[0] ?? '');
  }
  const vertical = headerMatchCount(columnA);
  return vertical >= TRANSPOSED_MIN_MATCHES && vertical > horizontal;
}

/** Transpose a cell matrix (headers-in-column-A → headers-in-row-1). */
export function transposeMatrix(matrix: string[][]): string[][] {
  const width = Math.max(...matrix.map((r) => r.length));
  const out: string[][] = [];
  for (let c = 0; c < width; c++) {
    const row: string[] = [];
    for (let r = 0; r < matrix.length; r++) row.push(matrix[r]?.[c] ?? '');
    out.push(row);
  }
  return out;
}

/** Convert a raw cell matrix into headers + data rows (skips title/preamble rows). */
export function matrixToTable(matrix: string[][]): DemoParsedTable {
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }
  const headerIdx = findHeaderRowIndex(matrix);
  const headers = (matrix[headerIdx] || []).map((h) => String(h ?? '').trim());
  const width = Math.max(headers.length, ...matrix.map((r) => r.length));
  const normalizedHeaders =
    headers.length < width
      ? [...headers, ...Array(width - headers.length).fill('')]
      : headers;

  const rows = matrix.slice(headerIdx + 1).map((row) => {
    const padded = [...row.map((c) => String(c ?? '').trim())];
    while (padded.length < normalizedHeaders.length) padded.push('');
    return padded.slice(0, normalizedHeaders.length);
  });

  return { headers: normalizedHeaders, rows };
}

/** Per-column auto-mapping analysis for the field-mapping modal (Pass 3). Same
 *  shape as the Normal-mode /api/batch-import/preview response columns. */
export type DemoHeaderAnalysis = {
  sourceColumn: string;
  /** Canonical snake_case field id when auto-mapped, else null */
  autoField: string | null;
  /** The demo alias table is keyed on canonical-normalized headers, so the
   *  alias and canonical passes of the Python parser collapse into 'alias'. */
  confidence: 'alias' | 'canonical' | 'fuzzy' | 'none';
  sampleValues: string[];
};

/**
 * Analyze a parsed table's headers: per column, which field the auto-mapping
 * would claim (exact alias first, fuzzy fallback second) plus sample values.
 * Powers the demo-mode field-mapping modal without any server call.
 */
export function analyzeHeaders(table: DemoParsedTable, maxSamples = 5): DemoHeaderAnalysis[] {
  return table.headers.map((header, i) => {
    const key = normalizeHeaderKey(header);
    let autoField: keyof DemoContactFields | null = HEADER_ALIASES[key] ?? null;
    let confidence: DemoHeaderAnalysis['confidence'] = autoField ? 'alias' : 'none';
    if (!autoField && key) {
      autoField = findFuzzyFieldMatch(key);
      if (autoField) confidence = 'fuzzy';
    }
    const sampleValues: string[] = [];
    for (const row of table.rows) {
      const value = row[i]?.trim();
      if (value) sampleValues.push(value);
      if (sampleValues.length >= maxSamples) break;
    }
    return {
      sourceColumn: header,
      autoField: autoField ? camelToSnake(autoField) : null,
      confidence,
      sampleValues,
    };
  });
}

/** Drop title/section/header-echo rows that are not real contacts. */export function isUsefulDemoContactRow(
  headers: string[],
  cols: string[]
): boolean {
  const fields = mapRowToContactFields(headers, cols, { allowPositionalFallback: false });
  const email = (fields.email || '').trim();
  if (email.includes('@')) return true;

  const name = (fields.fullName || [fields.firstName, fields.lastName].filter(Boolean).join(' '))
    .trim();
  if (!name || name.length < 2) return false;
  if (looksLikeSectionOrTitle(name)) return false;

  // Require at least one mapped contact field when headers are known
  const mappedCount = Object.values(fields).filter((v) => typeof v === 'string' && v.trim()).length;
  if (headerRowMatchScore(headers) > 0 && mappedCount === 0) return false;

  return mappedCount > 0;
}

function looksLikeSectionOrTitle(value: string): boolean {
  const upper = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  return /^(BASE DE DATOS|INFORMACION( GENERAL)?|DATOS GENERALES|LISTADO|DIRECTORIO)\b/.test(
    upper
  );
}

const KEY_VALUE_LINE_RE = /^\s*([^:\n]+?)\s*:\s*(.+?)\s*$/;

/** Whitespace-separated key-value paste: "full_name    John Doe" / tab-separated,
 *  no colon. Only accepted via matchKeyValueLine, which requires the label to be a
 *  known field alias — otherwise ordinary prose or table rows would be hijacked. */
const KEY_VALUE_WS_LINE_RE = /^\s*([^:\n]+?)(?:\t+| {2,})(.+?)\s*$/;

/** Match a pasted 'label: value' or 'label<tab/2+ spaces>value' line.
 *  The whitespace form additionally requires the label to resolve to a known field
 *  (exact or fuzzy) and the value to NOT be a known alias itself — that keeps genuine
 *  table header rows (e.g. a TSV line "full_name\temail", both cells aliases) on the
 *  tabular parsing path. Mirrors api-server file_parser._match_key_value_line. */
function matchKeyValueLine(line: string): [string, string] | null {
  const kv = line.trim().match(KEY_VALUE_LINE_RE);
  if (kv) return [kv[1].trim(), kv[2].trim()];
  const ws = line.trim().match(KEY_VALUE_WS_LINE_RE);
  if (!ws) return null;
  const key = ws[1].trim();
  const value = ws[2].trim();
  const normKey = normalizeHeaderKey(key);
  if (!HEADER_ALIASES[normKey] && findFuzzyFieldMatch(normKey) === null) return null;
  if (HEADER_ALIASES[normalizeHeaderKey(value)]) return null;
  return [key, value];
}

function splitTextSections(text: string): string[] {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  // Key-value paste blocks often have blank lines between label:value rows (HTML
  // table copy). Treat the whole block as one section — not separate records.
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (
    lines.length >= 2 &&
    lines.every((l) => matchKeyValueLine(l) !== null || isVerticalSectionTitle(l))
  ) {
    return [lines.join('\n')];
  }

  const sections = cleaned.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  return sections.length > 0 ? sections : [cleaned];
}

function isKeyValueSection(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length === 0) return false;
  const kvCount = nonEmpty.filter((l) => matchKeyValueLine(l.trim()) !== null).length;
  return kvCount >= 2 && kvCount / nonEmpty.length >= 0.6;
}

function parseKeyValueSection(lines: string[]): DemoParsedTable {
  const headers: string[] = [];
  const values: string[] = [];
  for (const line of lines) {
    let kv = matchKeyValueLine(line.trim());
    if (!kv) {
      // Whitespace-form line whose label is not a known alias: inside an
      // already-classified KV section it is still a genuine label/value line.
      // Keep it as a column so analyzeHeaders reports it as unmapped and the
      // mapping modal can offer it — dropping it here silently lost the value.
      const raw = line.trim().match(KEY_VALUE_WS_LINE_RE);
      if (raw) kv = [raw[1].trim(), raw[2].trim()];
    }
    if (!kv) continue;
    headers.push(kv[0]);
    values.push(kv[1]);
  }
  return { headers, rows: values.length ? [values] : [] };
}

function rowEchoesHeader(headers: string[], cols: string[]): boolean {
  if (headers.length === 0 || cols.length === 0) return false;
  const width = Math.max(headers.length, cols.length);
  let matches = 0;
  for (let i = 0; i < width; i++) {
    const h = normalizeHeaderKey(headers[i] || '');
    const c = normalizeHeaderKey(cols[i] || '');
    if (h && c && h === c) matches += 1;
  }
  return matches >= 2;
}

function padRow(row: string[], width: number): string[] {
  const padded = [...row.map((c) => String(c ?? '').trim())];
  while (padded.length < width) padded.push('');
  return padded.slice(0, width);
}

function mergeParsedTables(tables: DemoParsedTable[]): DemoParsedTable {
  const useful = tables.filter((t) => t.rows.length > 0);
  if (useful.length === 0) return { headers: [], rows: [] };
  if (useful.length === 1) return useful[0];

  const headers = useful[0].headers;
  const width = Math.max(headers.length, ...useful.map((t) => t.headers.length));
  const normalizedHeaders =
    headers.length < width ? [...headers, ...Array(width - headers.length).fill('')] : headers;

  const rows: string[][] = [];
  for (const table of useful) {
    for (const row of table.rows) {
      if (rowEchoesHeader(table.headers, row)) continue;
      rows.push(padRow(row, width));
    }
  }
  return { headers: normalizedHeaders, rows };
}

function parseDelimitedSection(lines: string[]): DemoParsedTable {
  if (lines.length === 0) return { headers: [], rows: [] };

  let bestDelim: ',' | ';' | '\t' = detectDelimiter(lines[0]);
  let bestScore = -1;
  for (const line of lines.slice(0, 20)) {
    for (const d of [',', ';', '\t'] as const) {
      const score = headerRowMatchScore(splitDelimitedLine(line, d));
      if (score > bestScore) {
        bestScore = score;
        bestDelim = d;
      }
    }
  }

  const matrix = lines.map((line) => splitDelimitedLine(line, bestDelim));
  return matrixToTable(matrix);
}

function parseSingleTextSection(text: string): DemoParsedTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  if (isKeyValueSection(lines)) return parseKeyValueSection(lines);
  return parseDelimitedSection(lines);
}

function looksLikeTabularText(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;
  const delimiter = detectDelimiter(lines.slice(0, 5).join('\n'));
  const matrix = lines.slice(0, 20).map((line) => splitDelimitedLine(line, delimiter));
  if (!matrix[0] || matrix[0].length < 2) return false;
  return headerRowMatchScore(matrix[findHeaderRowIndex(matrix)] || []) >= 2;
}

/** Strip optional "label: value" prefix from a pasted cell line. */
function stripPastedCellValue(line: string): string {
  const trimmed = line.replace(/\t+$/, '').trim();
  const kv = trimmed.match(KEY_VALUE_LINE_RE);
  if (kv) return kv[2].trim();
  return trimmed;
}

function lineLooksLikeHeaderLabel(line: string): boolean {
  const trimmed = line.trim();
  const kv = trimmed.match(KEY_VALUE_LINE_RE);
  if (kv) {
    const value = kv[2].trim();
    if (
      value &&
      (value.includes('@') ||
        digitsOnly(value).length >= 4 ||
        (value.split(/\s+/).length >= 2 && !HEADER_ALIASES[normalizeHeaderKey(value)]))
    ) {
      return false;
    }
  }
  const label = stripPastedCellValue(line).split(':')[0]?.trim() ?? '';
  const key = normalizeHeaderKey(label);
  if (!key) return false;
  if (HEADER_ALIASES[key]) return true;
  return findFuzzyFieldMatch(key) !== null;
}

/**
 * Reconstruct tabular data when HTML tables are copied as one cell per line
 * (headers stacked vertically, then data rows stacked the same way).
 */
function reconstructStackedTablePaste(text: string): DemoParsedTable | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t+$/, '').trim())
    .filter((l) => l.length > 0);

  if (lines.length < 4) return null;

  let headerEnd = 0;
  while (headerEnd < lines.length && headerEnd < 12 && lineLooksLikeHeaderLabel(lines[headerEnd])) {
    headerEnd += 1;
  }
  if (headerEnd < 2) return null;

  const headers = lines.slice(0, headerEnd).map((l) => {
    const raw = stripPastedCellValue(l);
    const colon = raw.indexOf(':');
    if (colon > 0 && colon < 24 && !raw.includes('@')) {
      return raw.slice(0, colon).trim();
    }
    return raw;
  });

  const colCount = headers.length;
  const dataLines = lines.slice(headerEnd).map(stripPastedCellValue);
  const rows: string[][] = [];

  let idx = 0;
  while (idx < dataLines.length) {
    const chunk = dataLines.slice(idx, idx + colCount);
    if (chunk.length === 0) break;
    const row = [...chunk];
    while (row.length < colCount) row.push('');
    rows.push(row.slice(0, colCount));
    idx += colCount;

    // Overflow phone lines after a full row (common when Ext holds two numbers).
    while (
      idx < dataLines.length &&
      !looksLikeEmail(dataLines[idx]) &&
      !looksLikePersonName(dataLines[idx]) &&
      digitsOnly(dataLines[idx]).length >= 4
    ) {
      const extra = dataLines[idx++];
      const last = rows[rows.length - 1];
      const extCol = headers.findIndex((h) => normalizeHeaderKey(h) === 'ext');
      const phoneCol = headers.findIndex((h) => {
        const k = normalizeHeaderKey(h);
        return k === 'telefono' || k === 'phone' || HEADER_ALIASES[k] === 'workPhone';
      });
      if (extCol >= 0 && !last[extCol]?.trim()) {
        last[extCol] = extra;
      } else if (phoneCol >= 0 && !last[phoneCol]?.trim()) {
        last[phoneCol] = extra;
      } else if (extCol >= 0) {
        last[extCol] = [last[extCol], extra].filter(Boolean).join('\n');
      }
    }
  }

  return rows.length > 0 ? { headers, rows } : null;
}

const VERTICAL_SKIP_HEADERS = new Set(['nombre', 'puesto', 'correo', 'ext', 'usuario']);

function isVerticalSectionTitle(line: string): boolean {
  const s = line.trim();
  return s.endsWith(':') && !s.includes('@') && s.length < 48;
}

/**
 * Parse vertically stacked contacts (name → title → email → phone(s) per person).
 * Mirrors api-server file_parser._parse_vertical_txt for Demo/Normal parity.
 */
export function parseVerticalContacts(text: string): DemoParsedTable {
  const cleanLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.includes('DEVELOPER NOTE')) break;
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const norm = normalizeHeaderKey(s);
    if (VERTICAL_SKIP_HEADERS.has(norm)) continue;
    if (isVerticalSectionTitle(s)) continue;
    cleanLines.push(s);
  }

  const headers = ['Nombre', 'Puesto', 'Correo', 'Teléfono', 'Móvil', 'Ext'];
  const rows: string[][] = [];

  let i = 0;
  while (i < cleanLines.length) {
    let emailIdx = -1;
    for (let j = i; j < Math.min(i + 12, cleanLines.length); j++) {
      if (looksLikeEmail(cleanLines[j])) {
        emailIdx = j;
        break;
      }
    }
    if (emailIdx === -1) break;

    let name = '';
    let title = '';
    if (emailIdx >= 2) {
      title = stripPastedCellValue(cleanLines[emailIdx - 1]);
      name = stripPastedCellValue(cleanLines[emailIdx - 2]);
    } else if (emailIdx === 1) {
      name = stripPastedCellValue(cleanLines[emailIdx - 1]);
    }

    const email = stripPastedCellValue(cleanLines[emailIdx]);
    const rawPhones: string[] = [];
    let pIdx = emailIdx + 1;
    while (pIdx < cleanLines.length) {
      const val = stripPastedCellValue(cleanLines[pIdx]);
      if (digitsOnly(val).length >= 4) {
        rawPhones.push(val);
        pIdx += 1;
      } else {
        break;
      }
    }

    let workPhone = '';
    let mobilePhone = '';
    let workPhoneExt = '';
    for (const p of rawPhones) {
      const digits = digitsOnly(p);
      if (digits.length < 8) {
        workPhoneExt = p;
      } else if (digits.startsWith('6') || digits.startsWith('7') || digits.startsWith('8')) {
        mobilePhone = p;
      } else {
        workPhone = p;
      }
    }

    rows.push([name, title, email, workPhone, mobilePhone, workPhoneExt]);
    i = pIdx;
  }

  return { headers, rows };
}

function isGoodParsedTable(table: DemoParsedTable): boolean {
  if (table.rows.length === 0) return false;
  if (headerRowMatchScore(table.headers) >= 2) return true;
  if (table.headers.some((h) => digitsOnly(h).length >= 7 && !h.includes('@'))) return false;
  return table.rows.some((cols) => isUsefulDemoContactRow(table.headers, cols));
}

function parseCsvTextStandard(text: string): DemoParsedTable {
  const sections = splitTextSections(text);
  if (sections.length <= 1) {
    return parseSingleTextSection(text.replace(/^\uFEFF/, '').trim());
  }
  return mergeParsedTables(sections.map(parseSingleTextSection));
}

/** Parse pasted/plain text: key-value blocks, tabular CSV/TSV, stacked HTML cells, or vertical stacks. */
export function parseCsvText(text: string): DemoParsedTable {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { headers: [], rows: [] };

  if (looksLikeTabularText(cleaned)) {
    const standard = parseCsvTextStandard(cleaned);
    if (isGoodParsedTable(standard)) return standard;
    const stacked = reconstructStackedTablePaste(cleaned);
    if (stacked && isGoodParsedTable(stacked)) return stacked;
    return standard.rows.length > 0 ? standard : stacked ?? standard;
  }

  // KV-shaped paste (colon/whitespace label-value lines, with or without tabs)
  // must reach the KV parser before the vertical email-anchor heuristic —
  // otherwise "Nom Complet: …" blocks get misread as vertical stacks and phone
  // values land in the wrong slots. Mirrors file_parser.py's
  // `_looks_like_tabular_text or _is_key_value_section` guard.
  const allLines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (isKeyValueSection(allLines)) {
    return parseCsvTextStandard(cleaned);
  }

  const vertical = parseVerticalContacts(cleaned);
  if (vertical.rows.length > 0) return vertical;

  const stacked = reconstructStackedTablePaste(cleaned);
  if (stacked && isGoodParsedTable(stacked)) return stacked;

  return parseCsvTextStandard(cleaned);
}

function looksLikeEmail(value: string): boolean {
  const v = stripPastedCellValue(value).trim();
  return v.includes('@') && !/\s/.test(v);
}

/* ------------------------------------------------------------------------ */
/* vCard (.vcf) parsing — mirrors api-server file_parser.py _parse_vcf.      */
/* ------------------------------------------------------------------------ */

/** Column holding one "NAME;PARAMS: value" line per vCard property that has no
 *  canonical field. The label has no header-alias overlap, so the fuzzy matcher
 *  never claims it; demo records retain it raw in headers/cols (Normal mode
 *  lands it in the record `extra` map). */
const VCF_UNMAPPED_COLUMN = 'vcf_unmapped';

/** Housekeeping properties that carry no contact data and are dropped on purpose. */
const VCF_IGNORED_PROPERTIES = new Set(['VERSION', 'PRODID', 'REV']);

/** Binary media payloads are never imported; a placeholder line is kept instead. */
const VCF_MEDIA_PROPERTIES = new Set(['PHOTO', 'LOGO', 'KEY', 'SOUND']);

/** Trailing extension hint inside a phone value, e.g. "+506 2200 0000 ext. 555". */
const VCF_EXT_SUFFIX_RE = /\s*(?:,|;|\s)\s*(?:ext\.?|extension|x)\s*[:.]?\s*(\d{1,6})\s*$/i;

/** Canonical field order (mirrors api-server data_normalizer.FIELD_MAPPING) so
 *  both parsers emit identically ordered vcf tables. */
const VCF_CANONICAL_ORDER = [
  'first_name',
  'last_name',
  'full_name',
  'email',
  'work_phone',
  'work_phone_ext',
  'mobile_phone',
  'address_street',
  'address_city',
  'address_state',
  'address_postal',
  'address_country',
  'social_instagram',
  'social_twitter',
  'social_facebook',
  'business_name',
  'business_title',
  'business_department',
  'business_url',
  'business_hours',
  'business_address_street',
  'business_address_city',
  'business_address_state',
  'business_address_postal',
  'business_address_country',
  'business_linkedin',
  'business_twitter',
  'personal_url',
  'personal_bio',
  'personal_birthday',
];

type VcfProperty = {
  name: string;
  /** Original pre-colon portion (params as written) — used for unmapped lines. */
  left: string;
  types: string[];
  params: Record<string, string>;
  /** QP-decoded but still text-escaped value. */
  value: string;
};

/** Split raw vCard text into logical lines: whitespace-folded continuations
 *  (3.0/4.0) and quoted-printable soft breaks (2.1, trailing '=') are rejoined. */
function vcfLogicalLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (raw === '') continue;
    const last = lines[lines.length - 1];
    if (lines.length > 0 && (raw[0] === ' ' || raw[0] === '\t')) {
      lines[lines.length - 1] = last + raw.slice(1);
    } else if (
      lines.length > 0 &&
      last.endsWith('=') &&
      last.split(':')[0].toUpperCase().includes('QUOTED-PRINTABLE')
    ) {
      // 2.1 quoted-printable soft break: the trailing '=' marks the fold and
      // is not part of the value.
      lines[lines.length - 1] =
        last.slice(0, -1) + (raw[0] === ' ' || raw[0] === '\t' ? raw.slice(1) : raw);
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

/** Split on `sep` occurrences not escaped with a backslash (escapes kept). */
function vcfSplitUnescaped(value: string, sep: string): string[] {
  const parts: string[] = [];
  let current = '';
  let escaped = false;
  for (const ch of value) {
    if (escaped) {
      current += '\\' + ch;
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === sep) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (escaped) current += '\\';
  parts.push(current);
  return parts;
}

/** vCard text escapes: \n / \N -> newline; \, \; \\ -> literal char. */
function vcfUnescape(value: string): string {
  return value.replace(/\\(.)/g, (_m, ch: string) =>
    ch === 'n' || ch === 'N' ? '\n' : ch
  );
}

/** Decode a QUOTED-PRINTABLE value (vCard 2.1) honouring CHARSET=. */
function vcfDecodeQuotedPrintable(value: string, charset?: string | null): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (
      code === 0x3d && // '='
      i + 2 < value.length &&
      /^[0-9A-Fa-f]{2}$/.test(value.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(code & 0xff);
    }
  }
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder((charset || 'utf-8').toLowerCase());
  } catch {
    decoder = new TextDecoder('utf-8');
  }
  return decoder.decode(new Uint8Array(bytes));
}

/** Parse one logical vCard line. Supports both 3.0/4.0 params
 *  (`TEL;TYPE=WORK,CELL:...`) and 2.1 bare tokens (`TEL;WORK;CELL:...`). */
function vcfParseProperty(line: string): VcfProperty | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const rawValue = line.slice(colon + 1);
  const segments = left.split(';');
  const name = (segments[0] || '').trim().toUpperCase();
  if (!name) return null;
  const types: string[] = [];
  const params: Record<string, string> = {};
  let encoding: string | null = null;
  let charset: string | null = null;
  for (const segRaw of segments.slice(1)) {
    const seg = segRaw.trim();
    if (!seg) continue;
    const eq = seg.indexOf('=');
    if (eq >= 0) {
      const key = seg.slice(0, eq).trim().toUpperCase();
      const val = seg.slice(eq + 1).trim();
      if (key === 'TYPE') {
        for (const t of val.split(',')) {
          const tt = t.trim().toUpperCase();
          if (tt) types.push(tt);
        }
      } else if (key === 'ENCODING') {
        encoding = val.toUpperCase();
      } else if (key === 'CHARSET') {
        charset = val;
      } else {
        params[key] = val;
      }
    } else {
      const token = seg.toUpperCase();
      if (token === 'QUOTED-PRINTABLE') encoding = 'QUOTED-PRINTABLE';
      else if (token === 'BASE64' || token === 'B') encoding = 'BASE64';
      else types.push(token);
    }
  }
  const value =
    encoding === 'QUOTED-PRINTABLE' ? vcfDecodeQuotedPrintable(rawValue, charset) : rawValue;
  return { name, left, types, params, value };
}

function vcfAssignTel(
  record: Record<string, string>,
  unmapped: string[],
  prop: VcfProperty
): void {
  let number = vcfUnescape(prop.value).trim();
  let ext = prop.params['EXT'] || prop.params['X-EXTENSION'] || '';
  const match = number.match(VCF_EXT_SUFFIX_RE);
  if (match) {
    ext = ext || match[1];
    number = number.slice(0, match.index).replace(/[ ,;]+$/, '');
  }
  const types = new Set(prop.types);
  let target: string | null;
  if (types.has('CELL')) {
    target = 'mobile_phone';
  } else if (types.has('HOME') || types.has('FAX') || types.has('PAGER')) {
    target = null; // no canonical home/fax field -> unmapped
  } else {
    target = 'work_phone'; // WORK, VOICE, or untyped
  }
  if (target && number && !(target in record)) {
    record[target] = number;
    if (ext && !('work_phone_ext' in record)) record['work_phone_ext'] = ext;
  } else {
    unmapped.push(`${prop.left}: ${number}${ext ? ` ext. ${ext}` : ''}`);
  }
}

function vcfAssignAdr(
  record: Record<string, string>,
  unmapped: string[],
  prop: VcfProperty
): void {
  const parts = vcfSplitUnescaped(prop.value, ';').map((p) => vcfUnescape(p).trim());
  while (parts.length < 7) parts.push('');
  const prefix = prop.types.includes('WORK') ? 'business_address' : 'address';
  const mapping: Record<string, string> = {
    [`${prefix}_street`]: parts.slice(0, 3).filter(Boolean).join(', '),
    [`${prefix}_city`]: parts[3],
    [`${prefix}_state`]: parts[4],
    [`${prefix}_postal`]: parts[5],
    [`${prefix}_country`]: parts[6],
  };
  let placed = false;
  for (const [field, val] of Object.entries(mapping)) {
    if (val && !(field in record)) {
      record[field] = val;
      placed = true;
    }
  }
  if (!placed) unmapped.push(`${prop.left}: ${vcfUnescape(prop.value).trim()}`);
}

/** Map one VCARD's properties onto canonical snake_case field ids. Anything
 *  without a canonical home is kept as a 'NAME;PARAMS: value' line in the
 *  vcf_unmapped column (never silently dropped). */
function vcfCardToRecord(properties: VcfProperty[]): Record<string, string> {
  const record: Record<string, string> = {};
  const unmapped: string[] = [];

  const assign = (field: string, value: string): boolean => {
    const v = (value || '').trim();
    if (v && !(field in record)) {
      record[field] = v;
      return true;
    }
    return false;
  };

  for (const prop of properties) {
    const { name, left, value } = prop;
    if (VCF_IGNORED_PROPERTIES.has(name)) continue;
    if (VCF_MEDIA_PROPERTIES.has(name)) {
      unmapped.push(`${left}: <media omitted>`);
      continue;
    }
    if (name === 'N') {
      const parts = vcfSplitUnescaped(value, ';').map((p) => vcfUnescape(p).trim());
      assign('last_name', parts[0] || '');
      assign('first_name', [parts[1], parts[2]].filter(Boolean).join(' '));
    } else if (name === 'FN') {
      assign('full_name', vcfUnescape(value));
    } else if (name === 'ORG') {
      const units = vcfSplitUnescaped(value, ';').map((p) => vcfUnescape(p).trim());
      assign('business_name', units[0] || '');
      assign('business_department', units.slice(1).filter(Boolean).join('; '));
    } else if (name === 'TITLE') {
      assign('business_title', vcfUnescape(value));
    } else if (name === 'TEL') {
      vcfAssignTel(record, unmapped, prop);
    } else if (name === 'EMAIL') {
      if (!assign('email', vcfUnescape(value))) {
        unmapped.push(`${left}: ${vcfUnescape(value).trim()}`);
      }
    } else if (name === 'ADR') {
      vcfAssignAdr(record, unmapped, prop);
    } else if (name === 'URL') {
      const target =
        prop.types.includes('HOME') || prop.types.includes('PERSONAL')
          ? 'personal_url'
          : 'business_url';
      if (!assign(target, vcfUnescape(value))) {
        unmapped.push(`${left}: ${vcfUnescape(value).trim()}`);
      }
    } else if (name === 'NOTE') {
      if (!assign('personal_bio', vcfUnescape(value))) {
        unmapped.push(`${left}: ${vcfUnescape(value).trim()}`);
      }
    } else if (name === 'BDAY') {
      if (!assign('personal_birthday', vcfUnescape(value))) {
        unmapped.push(`${left}: ${vcfUnescape(value).trim()}`);
      }
    } else if (name === 'X-EXTENSION') {
      if (!assign('work_phone_ext', vcfUnescape(value))) {
        unmapped.push(`${left}: ${vcfUnescape(value).trim()}`);
      }
    } else {
      unmapped.push(`${left}: ${vcfUnescape(value).trim()}`);
    }
  }

  if (!('full_name' in record)) {
    const assembled = [record['first_name'], record['last_name']].filter(Boolean).join(' ');
    if (assembled) record['full_name'] = assembled;
  }
  if (unmapped.length > 0) record[VCF_UNMAPPED_COLUMN] = unmapped.join('\n');
  return record;
}

/**
 * Parse a .vcf file (vCard 2.1/3.0/4.0) into a table with one row per VCARD and
 * canonical snake_case field ids as headers, so the standard
 * mapRowToContactFields pipeline applies unchanged. A truncated final card
 * without END:VCARD is still emitted best-effort.
 */
export function parseVcf(text: string): DemoParsedTable {
  const cards: VcfProperty[][] = [];
  let current: VcfProperty[] | null = null;
  for (const line of vcfLogicalLines(text)) {
    const tag = line.trim().toUpperCase();
    if (tag === 'BEGIN:VCARD') {
      current = [];
    } else if (tag === 'END:VCARD') {
      if (current) cards.push(current);
      current = null;
    } else if (current) {
      const prop = vcfParseProperty(line);
      if (prop) current.push(prop);
    }
  }
  if (current && current.length > 0) cards.push(current);

  const records = cards
    .map(vcfCardToRecord)
    .filter((r) => Object.keys(r).length > 0);
  const headers = VCF_CANONICAL_ORDER.filter((k) => records.some((r) => k in r));
  if (records.some((r) => VCF_UNMAPPED_COLUMN in r)) headers.push(VCF_UNMAPPED_COLUMN);
  return { headers, rows: records.map((r) => headers.map((h) => r[h] ?? '')) };
}

function looksLikeWebsite(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v.includes('@')) return false;
  return /^(https?:\/\/|www\.)/i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(v);
}

function looksLikePersonName(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 2 || v.length > 80) return false;
  if (looksLikeEmail(v) || looksLikeWebsite(v)) return false;
  if (digitsOnly(v).length >= 4) return false;
  return /^[\p{L}\p{M}'.\- ]+$/u.test(v) && v.includes(' ');
}

/** Infer field type from cell value when headers are missing or unrecognized. */
function inferFieldFromValue(value: string): keyof DemoContactFields | null {
  const v = value.trim();
  if (!v) return null;
  if (looksLikeEmail(v)) return 'email';
  if (looksLikeWebsite(v)) return 'businessUrl';
  if (looksLikePhoneNumber(v)) return 'workPhone';
  if (looksLikeExtension(v)) return 'workPhoneExt';
  if (looksLikePersonName(v)) return 'fullName';
  return null;
}

/**
 * When headers did not map a column, infer from value shape and fill gaps in a
 * conservative order (name → title → email → phone → mobile → ext → website).
 */
function inferUnmappedColumns(
  fields: DemoContactFields,
  cols: string[],
  unmatchedIndices: number[]
): void {
  const indices =
    unmatchedIndices.length > 0 ? unmatchedIndices : cols.map((_, i) => i);
  const inferred: Partial<Record<keyof DemoContactFields, string>> = {};
  for (const i of indices) {
    const value = cols[i]?.trim();
    if (!value) continue;
    const field = inferFieldFromValue(value);
    if (!field || fields[field] || inferred[field]) continue;
    inferred[field] = value;
  }

  const order: (keyof DemoContactFields)[] = [
    'fullName',
    'businessTitle',
    'email',
    'workPhone',
    'mobilePhone',
    'workPhoneExt',
    'businessUrl',
  ];
  for (const key of order) {
    if (!fields[key] && inferred[key]) {
      fields[key] = inferred[key]!;
    }
  }
}

/**
 * Apply project Work Phone Prefix: 4-digit values in phone/ext columns that are
 * really local numbers (not short extensions) get the prefix prepended.
 */
export function applyWorkPhonePrefix(
  fields: DemoContactFields,
  workPhonePrefix?: string | null
): void {
  if (!workPhonePrefix?.trim()) return;
  const prefix = workPhonePrefix.trim();

  if (fields.workPhoneExt && !fields.workPhone) {
    const extDigits = digitsOnly(fields.workPhoneExt);
    if (extDigits.length === 4) {
      fields.workPhone = prefix + extDigits;
      delete fields.workPhoneExt;
    }
  }

  if (fields.workPhone) {
    const digits = digitsOnly(fields.workPhone);
    if (digits.length === 4) {
      fields.workPhone = prefix + digits;
    }
  }
}

function detectDelimiter(sample: string): ',' | ';' | '\t' {
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  };
  const best = (Object.entries(counts) as Array<[',' | ';' | '\t', number]>).sort(
    (a, b) => b[1] - a[1]
  )[0];
  return best[1] > 0 ? best[0] : ',';
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function colLettersToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n - 1;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siBlocks = xml.match(/<si[\s>][\s\S]*?<\/si>/g) || [];
  for (const block of siBlocks) {
    const parts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    );
    strings.push(parts.join(''));
  }
  return strings;
}

function cellRefParts(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: colLettersToIndex(m[1].toUpperCase()), row: parseInt(m[2], 10) };
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const grid = new Map<number, Map<number, string>>();
  let maxCol = -1;
  let maxRow = 0;

  // Self-closing cells (`<c r="D4" s="2"/>`, common for empty/styled-only
  // cells) MUST be matched before the open/close alternative. With the
  // open-tag pattern tried first, `[^>]*` happily swallows the cell's own
  // trailing `/`, then its lazy `([\s\S]*?)<\/c>` scans forward for the
  // NEXT `</c>` anywhere in the document — silently consuming every
  // subsequent self-closing cell plus the next real cell's contents (e.g.
  // a header cell one or two rows down) as if it were "inside" the empty
  // cell, and skipping them entirely. Real-world exports routinely have
  // runs of empty self-closing cells right before a header/data row, so
  // this reliably ate the header immediately following them.
  const cellRe = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let match: RegExpExecArray | null;
  while ((match = cellRe.exec(xml))) {
    const isSelfClosing = match[1] !== undefined;
    const attrs = isSelfClosing ? match[1] : match[2] ?? '';
    const inner = isSelfClosing ? '' : match[3] ?? '';
    const refMatch = attrs.match(/\br="([A-Z]+\d+)"/i);
    if (!refMatch) continue;
    const parts = cellRefParts(refMatch[1]);
    if (!parts) continue;

    const typeMatch = attrs.match(/\bt="([^"]+)"/);
    const type = typeMatch?.[1];
    let value = '';

    if (type === 'inlineStr') {
      const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      value = tMatch ? decodeXmlEntities(tMatch[1]) : '';
    } else {
      const vMatch = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      const raw = vMatch ? vMatch[1].trim() : '';
      if (type === 's') {
        const idx = parseInt(raw, 10);
        value = Number.isFinite(idx) ? sharedStrings[idx] ?? '' : '';
      } else if (type === 'b') {
        value = raw === '1' ? 'TRUE' : 'FALSE';
      } else {
        value = decodeXmlEntities(raw);
      }
    }

    if (!grid.has(parts.row)) grid.set(parts.row, new Map());
    grid.get(parts.row)!.set(parts.col, value);
    maxCol = Math.max(maxCol, parts.col);
    maxRow = Math.max(maxRow, parts.row);
  }

  if (maxRow === 0 || maxCol < 0) return [];

  const rows: string[][] = [];
  for (let r = 1; r <= maxRow; r++) {
    const rowMap = grid.get(r);
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      row.push(rowMap?.get(c) ?? '');
    }
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<DemoParsedTable> {
  const zip = await JSZip.loadAsync(buffer);
  const ssFile = zip.file('xl/sharedStrings.xml');
  const sharedStrings = ssFile ? parseSharedStrings(await ssFile.async('string')) : [];

  const sheetPath =
    zip.file('xl/worksheets/sheet1.xml')?.name ||
    Object.keys(zip.files).find((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p));

  if (!sheetPath) {
    throw new Error('Demo Excel parse failed: no worksheet found in .xlsx');
  }

  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) {
    throw new Error('Demo Excel parse failed: worksheet unreadable');
  }

  const matrix = parseSheetRows(await sheetFile.async('string'), sharedStrings);
  // Transposed sheets (headers down column A, one contact per column B+) are
  // flipped into the standard row layout before header detection.
  return matrixToTable(isTransposedMatrix(matrix) ? transposeMatrix(matrix) : matrix);
}

export function mapRowToContactFields(
  headers: string[],
  cols: string[],
  options: {
    allowPositionalFallback?: boolean;
    workPhonePrefix?: string | null;
    /** Explicit user mapping (Pass 3): snake_case canonical targets or 'ignore';
     *  consulted before alias/fuzzy auto-mapping. */
    explicitMapping?: Array<{ sourceColumn: string; targetField: string }>;
  } = {}
): DemoContactFields {
  // An explicit mapping expresses the user's full intent — positional guessing
  // would contradict it (e.g. an ignored name column must stay unmapped).
  const allowPositionalFallback =
    options.allowPositionalFallback !== false && !options.explicitMapping?.length;
  const explicitByKey = new Map<string, string>();
  for (const entry of options.explicitMapping ?? []) {
    const key = normalizeHeaderKey(entry.sourceColumn);
    if (key) explicitByKey.set(key, entry.targetField);
  }
  const fields: DemoContactFields = {};
  let mappedFromHeaders = 0;
  const unmatchedHeaderIdx: number[] = [];
  headers.forEach((header, i) => {
    const normalizedKey = normalizeHeaderKey(header);
    const explicitTarget = explicitByKey.get(normalizedKey);
    if (explicitTarget !== undefined) {
      // Explicit user mapping wins over every auto pass; 'ignore' claims the
      // column without mapping it (raw headers/cols stay on the record anyway).
      if (explicitTarget !== 'ignore') {
        const key = snakeToCamel(explicitTarget) as keyof DemoContactFields;
        const value = cols[i]?.trim();
        if (value) {
          fields[key] = value;
          mappedFromHeaders += 1;
        }
      }
      return;
    }
    const key = HEADER_ALIASES[normalizedKey];
    if (!key) {
      unmatchedHeaderIdx.push(i);
      return;
    }
    const value = cols[i]?.trim();
    // First column claiming a field wins — a second exact-alias column for the
    // same field (e.g. "Phone" then "Teléfono Oficina") must not overwrite it,
    // same guarantee the fuzzy pass below already makes.
    if (value && !fields[key]) {
      fields[key] = value;
      mappedFromHeaders += 1;
    }
  });

  // Fuzzy fallback: headers that didn't exactly match a known alias (label
  // mismatches like "Teléfono Oficina 2", "Cel./WhatsApp") get a second look
  // via token-based partial matching, without ever overwriting a field a
  // real header already claimed.
  for (const i of unmatchedHeaderIdx) {
    const normalizedKey = normalizeHeaderKey(headers[i]);
    if (!normalizedKey) continue;
    const value = cols[i]?.trim();
    if (!value) continue;
    const fuzzyField = findFuzzyFieldMatch(normalizedKey);
    if (fuzzyField && !fields[fuzzyField]) {
      fields[fuzzyField] = value;
      mappedFromHeaders += 1;
    }
  }

  // Name fallback: applied per-field, independent of whether OTHER columns
  // (email, title, ...) matched a known header. Without this, a sheet with
  // a recognized "Email"/"Puesto" header but an unrecognized name column
  // (e.g. "Nombre y Apellido") silently produced contacts with no name at
  // all — the row still counted as "useful" (it has an email) but the
  // rendered card had a blank name field.
  //
  // Safe against the earlier title/preamble bug: this function only ever
  // sees rows that already passed header-row detection (matrixToTable) and,
  // for real uploads, the isUsefulDemoContactRow filter — never the header
  // row or pre-header title rows.
  const nameMappedFromHeader = Boolean(fields.fullName || fields.firstName || fields.lastName);
  // Never promote an email-shaped first cell to a name — that happens with
  // vcf-derived tables whose card has no N/FN (headers are canonical ids, so
  // positional meaning does not apply).
  if (allowPositionalFallback && !nameMappedFromHeader && cols[0] && !looksLikeEmail(cols[0])) {
    fields.fullName = cols[0];
  }

  // Legacy fully-unheadered sheets (no header matched anything at all):
  // also recover first/last/email positionally, matching the conventional
  // name,first,last,email column order.
  if (allowPositionalFallback && mappedFromHeaders === 0 && headerRowMatchScore(headers) === 0) {
    if (!fields.firstName && cols[1]) fields.firstName = cols[1];
    if (!fields.lastName && cols[2]) fields.lastName = cols[2];
    if (!fields.email && cols[3]) fields.email = cols[3];
  }

  if (!fields.fullName && (fields.firstName || fields.lastName)) {
    fields.fullName = [fields.firstName, fields.lastName].filter(Boolean).join(' ');
  }

  // Multi-word "nombre" values are full names, not a lone given name.
  if (fields.firstName && !fields.lastName && fields.firstName.includes(' ')) {
    fields.fullName = fields.firstName;
  }

  // Never treat a bare column-label echo as an email
  if (fields.email && !fields.email.includes('@')) {
    delete fields.email;
  }

  // Value-based inference only for blank/unknown headers — never overwrite mapped fields.
  const inferIndices = unmatchedHeaderIdx.filter((i) => !headers[i]?.trim());
  if (mappedFromHeaders === 0 && headerRowMatchScore(headers) === 0) {
    inferUnmappedColumns(fields, cols, cols.map((_, i) => i));
  } else if (inferIndices.length > 0) {
    inferUnmappedColumns(fields, cols, inferIndices);
  }

  reconcilePhoneAndExtension(fields);
  applyWorkPhonePrefix(fields, options.workPhonePrefix);

  // Person-name title case at first ingest only (mirrors Normal DataNormalizer.format_field
  // for name fields). Never re-applied on export/render or on later record edits.
  // businessName is intentionally excluded — brand casing must be preserved.
  for (const key of DEMO_PERSON_NAME_KEYS) {
    const v = fields[key as keyof DemoContactFields];
    if (typeof v === 'string' && v.trim()) {
      (fields as Record<string, string | null | undefined>)[key] = capitalizeName(v);
    }
  }

  return fields;
}

async function readFileBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  // jsdom File polyfill (Jest) often lacks arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseDemoSpreadsheetFile(file: File): Promise<DemoParsedTable> {
  const ext = fileExtension(file.name);

  if (ext === '.xls') {
    throw new Error(
      'Demo mode cannot parse legacy .xls files. Save as .xlsx or .csv, or disable Demo mode to use the server parser.'
    );
  }

  const buffer = await readFileBuffer(file);
  const bytes = new Uint8Array(buffer);

  if (ext === '.vcf') {
    return parseVcf(new TextDecoder('utf-8').decode(bytes));
  }

  if (ext === '.xlsx' || looksLikeZip(bytes)) {
    try {
      return await parseXlsxBuffer(buffer);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Demo Excel')) throw err;
      throw new Error(
        `Demo mode failed to parse Excel file: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

  // .csv / .txt / unknown text
  const text = new TextDecoder('utf-8').decode(bytes);
  if (/[\u0000-\u0008]/.test(text.slice(0, 200))) {
    throw new Error(
      'File looks binary. In Demo mode use a real .xlsx or UTF-8 .csv (not a renamed binary).'
    );
  }
  return parseCsvText(text);
}
