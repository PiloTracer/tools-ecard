/**
 * Demo-mode spreadsheet parser.
 * CSV/TXT via text; XLSX via JSZip + worksheet XML (no server / no new deps).
 */

import JSZip from 'jszip';
import { capitalizeName, DEMO_PERSON_NAME_KEYS } from './nameCapitalize';

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
  businessName?: string | null;
  businessTitle?: string | null;
  businessDepartment?: string | null;
  businessUrl?: string | null;
  personalBio?: string | null;
};

const HEADER_ALIASES: Record<string, keyof DemoContactFields> = {
  first_name: 'firstName',
  firstname: 'firstName',
  first: 'firstName',
  fname: 'firstName',
  given_name: 'firstName',
  nombre: 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  last: 'lastName',
  lname: 'lastName',
  surname: 'lastName',
  family_name: 'lastName',
  apellidos: 'lastName',
  apellido: 'lastName',
  full_name: 'fullName',
  fullname: 'fullName',
  name: 'fullName',
  nombre_completo: 'fullName',
  email: 'email',
  e_mail: 'email',
  mail: 'email',
  correo: 'email',
  correo_electronico: 'email',
  work_phone: 'workPhone',
  workphone: 'workPhone',
  office_phone: 'workPhone',
  business_phone: 'workPhone',
  phone: 'workPhone',
  tel: 'workPhone',
  telefono: 'workPhone',
  telefono_ofi: 'workPhone',
  work_phone_ext: 'workPhoneExt',
  ext: 'workPhoneExt',
  extension: 'workPhoneExt',
  mobile_phone: 'mobilePhone',
  mobilephone: 'mobilePhone',
  mobile: 'mobilePhone',
  cell: 'mobilePhone',
  cellular: 'mobilePhone',
  celular: 'mobilePhone',
  movil: 'mobilePhone',
  whatsapp: 'mobilePhone',
  whats_app: 'mobilePhone',
  cel_whatsapp: 'mobilePhone',
  address_street: 'addressStreet',
  address: 'addressStreet',
  street: 'addressStreet',
  direccion: 'addressStreet',
  calle: 'addressStreet',
  address_city: 'addressCity',
  city: 'addressCity',
  ciudad: 'addressCity',
  address_state: 'addressState',
  state: 'addressState',
  province: 'addressState',
  estado: 'addressState',
  provincia: 'addressState',
  address_postal: 'addressPostal',
  zip: 'addressPostal',
  postal: 'addressPostal',
  codigo_postal: 'addressPostal',
  address_country: 'addressCountry',
  country: 'addressCountry',
  pais: 'addressCountry',
  business_name: 'businessName',
  organization: 'businessName',
  company: 'businessName',
  empresa: 'businessName',
  business_title: 'businessTitle',
  title: 'businessTitle',
  job_title: 'businessTitle',
  position: 'businessTitle',
  puesto: 'businessTitle',
  cargo: 'businessTitle',
  business_department: 'businessDepartment',
  department: 'businessDepartment',
  departamento: 'businessDepartment',
  business_url: 'businessUrl',
  website: 'businessUrl',
  url: 'businessUrl',
  personal_bio: 'personalBio',
  notes: 'personalBio',
  comments: 'personalBio',
  notas: 'personalBio',
};

/** Minimum alias length considered for substring (fuzzy) header matching — keeps short
 *  aliases like "ext"/"url"/"tel" restricted to exact-token matches only, avoiding false
 *  positives on unrelated headers that merely contain those letters. */
const FUZZY_MIN_ALIAS_LEN = 4;

/**
 * Fuzzy fallback for headers that don't exactly match a known alias — e.g. "Teléfono
 * Oficina 2", "Cel./WhatsApp", "Correo Electrónico Personal". Splits the normalized key
 * into tokens and looks for a known field via exact-token lookup first, then substring
 * containment for longer alias keywords. If tokens point to more than one distinct
 * field (a genuinely compound header like "Nombre y Apellido"), returns null so the
 * existing positional-name fallback handles it instead of guessing wrong.
 */
function findFuzzyFieldMatch(normalizedKey: string): keyof DemoContactFields | null {
  const tokens = normalizedKey.split('_').filter(Boolean);
  const matchedFields = new Set<keyof DemoContactFields>();

  for (const token of tokens) {
    const direct = HEADER_ALIASES[token];
    if (direct) {
      matchedFields.add(direct);
      continue;
    }
    // Below the length floor, only an exact-token hit (above) counts — a short
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

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
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

/** Drop title/section/header-echo rows that are not real contacts. */
export function isUsefulDemoContactRow(
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

function splitTextSections(text: string): string[] {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];
  const sections = cleaned.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  return sections.length > 0 ? sections : [cleaned];
}

function isKeyValueSection(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length === 0) return false;
  const kvCount = nonEmpty.filter((l) => KEY_VALUE_LINE_RE.test(l.trim())).length;
  return kvCount >= 2 && kvCount / nonEmpty.length >= 0.6;
}

function parseKeyValueSection(lines: string[]): DemoParsedTable {
  const headers: string[] = [];
  const values: string[] = [];
  for (const line of lines) {
    const m = line.trim().match(KEY_VALUE_LINE_RE);
    if (!m) continue;
    headers.push(m[1].trim());
    values.push(m[2].trim());
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

/** Parse pasted/plain text: key-value blocks, tabular CSV/TSV, or multiple sections. */
export function parseCsvText(text: string): DemoParsedTable {
  const sections = splitTextSections(text);
  if (sections.length <= 1) {
    return parseSingleTextSection(text.replace(/^\uFEFF/, '').trim());
  }
  return mergeParsedTables(sections.map(parseSingleTextSection));
}

function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.includes('@') && !/\s/.test(v);
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
  return matrixToTable(matrix);
}

export function mapRowToContactFields(
  headers: string[],
  cols: string[],
  options: { allowPositionalFallback?: boolean; workPhonePrefix?: string | null } = {}
): DemoContactFields {
  const allowPositionalFallback = options.allowPositionalFallback !== false;
  const fields: DemoContactFields = {};
  let mappedFromHeaders = 0;
  const unmatchedHeaderIdx: number[] = [];
  headers.forEach((header, i) => {
    const key = HEADER_ALIASES[normalizeHeaderKey(header)];
    if (!key) {
      unmatchedHeaderIdx.push(i);
      return;
    }
    const value = cols[i]?.trim();
    if (value) {
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
  if (allowPositionalFallback && !nameMappedFromHeader && cols[0]) {
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

  if (ext === '.vcf') {
    throw new Error(
      'Demo mode does not parse .vcf yet. Use .csv or .xlsx, or disable Demo mode for full server parsing.'
    );
  }

  const buffer = await readFileBuffer(file);
  const bytes = new Uint8Array(buffer);

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
