"""
File Parser Module
Handles parsing of various file formats: CSV, XLS, XLSX, TXT, JSON, VCF
Extracted from __script_v9.py
"""

import csv
import os
import json
import logging
import quopri
import re
import unicodedata
from typing import List

import pandas as pd
import chardet

from data_normalizer import (
    FIELD_MAPPING,
    CANONICAL_FIELD_MAP,
    _alias_tokens,
    _normalize_header_token,
    _canonical_header_key,
    find_fuzzy_field_match,
)

logger = logging.getLogger(__name__)

KEY_VALUE_LINE_RE = re.compile(r'^\s*(?P<key>[^:]+?)\s*:\s*(?P<value>.+?)\s*$')

# Whitespace-separated key-value paste: "full_name    John Doe" / "full_name\tJohn Doe"
# (no colon). Only accepted via _match_key_value_line, which requires the label to be a
# known field alias — otherwise ordinary prose or table rows would be hijacked.
KEY_VALUE_WS_LINE_RE = re.compile(r'^\s*(?P<key>[^:\n]+?)(?:\t+| {2,})(?P<value>.+?)\s*$')

# Minimum header hits in column A before a sheet is considered transposed (headers
# down column A, one contact per column B+). The transposed orientation also requires
# a strictly higher score than the best horizontal row, so ambiguous sheets keep the
# status-quo horizontal parsing.
TRANSPOSED_MIN_MATCHES = 3

# --- vCard (.vcf) parsing ----------------------------------------------------

# Housekeeping properties that carry no contact data and are dropped on purpose.
VCF_IGNORED_PROPERTIES = {"VERSION", "PRODID", "REV"}
# Binary media payloads are never imported; a placeholder line is kept in the
# unmapped notes instead of the (potentially huge) base64 blob.
VCF_MEDIA_PROPERTIES = {"PHOTO", "LOGO", "KEY", "SOUND"}
# Column holding one "NAME;PARAMS: value" line per vCard property that has no
# canonical field (consistent with the Pass 0 "unmapped columns -> extra" rule;
# the label has no header-alias overlap, so the fuzzy matcher never claims it).
VCF_UNMAPPED_COLUMN = "vcf_unmapped"

# Trailing extension hint inside a phone value, e.g. "+506 2200 0000 ext. 555".
VCF_EXT_SUFFIX_RE = re.compile(
    r"\s*(?:,|;|\s)\s*(?:ext\.?|extension|x)\s*[:.]?\s*(\d{1,6})\s*$",
    re.IGNORECASE,
)


def _match_key_value_line(line: str):
    """Match a pasted 'label: value' or 'label<tab/2+ spaces>value' line.

    Returns (key, value) or None. The whitespace form additionally requires the label
    to resolve to a known field (canonical or fuzzy) and the value to NOT be a known
    field alias itself — that keeps genuine table header rows (e.g. a TSV line
    'full_name\\temail', where both cells are aliases) on the tabular parsing path.
    """
    match = KEY_VALUE_LINE_RE.match(line.strip())
    if match:
        return match.group('key').strip(), match.group('value').strip()
    ws = KEY_VALUE_WS_LINE_RE.match(line.strip())
    if not ws:
        return None
    key = ws.group('key').strip()
    value = ws.group('value').strip()
    if _canonical_header_key(key) not in CANONICAL_FIELD_MAP and find_fuzzy_field_match(key) is None:
        return None
    if _canonical_header_key(value) in CANONICAL_FIELD_MAP:
        return None
    return key, value


class FileParser:
    """
    Parses various file formats into pandas DataFrames
    Supports: CSV, XLS, XLSX, TXT, JSON, VCF
    """

    def detect_encoding(self, file_path: str) -> str:
        """Detect file encoding, trying UTF-8 first"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                f.read()
            return 'utf-8'
        except UnicodeDecodeError:
            pass

        # Fallback to chardet
        with open(file_path, 'rb') as f:
            rawdata = f.read(10000)
        result = chardet.detect(rawdata)
        encoding = result['encoding']
        logger.debug(f"Detected encoding: {encoding}")
        return encoding if encoding else 'utf-8'

    def _header_match_count(self, values) -> int:
        """Count how many of the given cell values look like known field headers
        (accent-insensitive substring match against FIELD_MAPPING aliases)."""
        all_keywords = [kw.lower() for sublist in FIELD_MAPPING.values() for kw in sublist]
        matches = 0
        for val in values:
            if pd.isna(val):
                continue
            val_str = str(val).lower().strip()
            # Remove accents for better matching
            val_normalized = ''.join(
                c for c in unicodedata.normalize('NFD', val_str)
                if unicodedata.category(c) != 'Mn'
            )
            if any(kw in val_normalized or val_normalized in kw for kw in all_keywords):
                matches += 1
        return matches

    def find_header_row(self, df: pd.DataFrame) -> int:
        """
        Scans the first few rows to find the one that best matches field mapping
        Returns the index of the header row
        """
        max_matches = 0
        header_idx = 0

        # Check first 20 rows
        for i in range(min(20, len(df))):
            matches = self._header_match_count(df.iloc[i])

            if matches > max_matches:
                max_matches = matches
                header_idx = i

        if max_matches == 0:
            logger.warning("Could not confidently detect header row. Assuming row 0.")
            return 0

        logger.debug(f"Found header row at index {header_idx} with {max_matches} matches")
        return header_idx

    def _is_transposed_matrix(self, df: pd.DataFrame) -> bool:
        """
        Detect a transposed layout: headers down column A, one contact per column
        B+ (mirrors demoSpreadsheetParser.ts isTransposedMatrix). Chosen only on a
        clear margin — column A must score at least TRANSPOSED_MIN_MATCHES header
        hits AND strictly more than the best horizontal row; ambiguous sheets keep
        the status-quo horizontal parsing.
        """
        if df.empty or df.shape[1] < 2:
            return False
        limit = min(20, len(df))
        horizontal = max(
            (self._header_match_count(df.iloc[i]) for i in range(limit)),
            default=0,
        )
        vertical = self._header_match_count(df.iloc[:limit, 0])
        return vertical >= TRANSPOSED_MIN_MATCHES and vertical > horizontal

    def _detect_delimiter(self, file_path: str, encoding: str) -> str:
        """
        Detect the most likely column delimiter for plain-text tabular data (paste from
        Excel/Sheets/Numbers can arrive as tab-, comma-, or semicolon-delimited). Mirrors
        demoSpreadsheetParser.ts detectDelimiter so Demo and Normal mode behave the same
        way for the same pasted content.
        """
        try:
            with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                sample = ''.join(f.readline() for _ in range(5))
        except OSError:
            sample = ''
        counts = {'\t': sample.count('\t'), ',': sample.count(','), ';': sample.count(';')}
        best_delim = max(counts, key=lambda d: counts[d])
        return best_delim if counts[best_delim] > 0 else '\t'

    def _read_raw_matrix(self, file_path: str, encoding: str, delimiter: str) -> pd.DataFrame:
        """
        Read the first 20 rows as a raw, header-less grid for header-row scoring only.
        Uses csv.reader (not pd.read_csv) because real-world exports routinely have a
        preamble/title row with far fewer columns than the data rows below it — pandas'
        C parser raises "Expected N fields, saw M" on that shape when header=None,
        whereas csv.reader tolerates ragged rows and pd.DataFrame() pads them with NaN.
        """
        rows: List[List[str]] = []
        try:
            with open(file_path, 'r', encoding=encoding, errors='replace', newline='') as f:
                reader = csv.reader(f, delimiter=delimiter)
                for i, row in enumerate(reader):
                    if i >= 20:
                        break
                    rows.append(row)
        except OSError:
            return pd.DataFrame()
        return pd.DataFrame(rows)

    def _split_text_sections(self, text: str) -> List[str]:
        cleaned = text.replace('\ufeff', '').strip()
        if not cleaned:
            return []
        lines = [ln.strip() for ln in cleaned.splitlines() if ln.strip()]
        if len(lines) >= 2 and all(
            _match_key_value_line(ln) or self._is_vertical_section_title(ln) for ln in lines
        ):
            return ['\n'.join(lines)]
        sections = [s.strip() for s in re.split(r'\n\s*\n+', cleaned) if s.strip()]
        return sections if sections else [cleaned]

    def _strip_labeled_value(self, line: str) -> str:
        stripped = line.strip()
        match = KEY_VALUE_LINE_RE.match(stripped)
        if match:
            return match.group('value').strip()
        return stripped

    def _looks_like_email(self, value: str) -> bool:
        v = self._strip_labeled_value(value).strip()
        return '@' in v and ' ' not in v

    def _is_vertical_section_title(self, line: str) -> bool:
        s = line.strip()
        return s.endswith(':') and '@' not in s and len(s) < 48

    def _is_key_value_section(self, lines: List[str]) -> bool:
        non_empty = [ln for ln in lines if ln.strip()]
        if not non_empty:
            return False
        kv_count = sum(1 for ln in non_empty if _match_key_value_line(ln.strip()))
        return kv_count >= 2 and kv_count / len(non_empty) >= 0.6

    def _parse_key_value_section(self, lines: List[str]) -> pd.DataFrame:
        headers: List[str] = []
        values: List[str] = []
        for line in lines:
            match = _match_key_value_line(line.strip())
            if not match:
                continue
            key, value = match
            headers.append(key)
            values.append(value)
        if not headers:
            return pd.DataFrame()
        return pd.DataFrame([values], columns=headers)

    def _looks_like_tabular_text(self, lines: List[str]) -> bool:
        """True when pasted content is row/column tabular (TSV/CSV), not vertical stacks."""
        non_empty = [ln for ln in lines if ln.strip()]
        if len(non_empty) < 2:
            return False
        delimiter = self._detect_delimiter_from_lines(non_empty[:5])
        matrix_rows: List[List[str]] = []
        for ln in non_empty[:20]:
            matrix_rows.append([c.strip() for c in ln.split(delimiter)])
        if not matrix_rows or len(matrix_rows[0]) < 2:
            return False
        df_temp = pd.DataFrame(matrix_rows)
        header_idx = self.find_header_row(df_temp)
        header_score_row = df_temp.iloc[header_idx].tolist()
        all_keywords = [kw.lower() for sublist in FIELD_MAPPING.values() for kw in sublist]
        matches = 0
        for val in header_score_row:
            if pd.isna(val):
                continue
            val_norm = _normalize_header_token(str(val))
            if any(kw in val_norm or val_norm in kw for kw in all_keywords):
                matches += 1
        return matches >= 2

    def _detect_delimiter_from_lines(self, lines: List[str]) -> str:
        sample = ''.join(lines)
        counts = {'\t': sample.count('\t'), ',': sample.count(','), ';': sample.count(';')}
        best = max(counts, key=lambda d: counts[d])
        return best if counts[best] > 0 else '\t'

    def _line_looks_like_header_label(self, line: str) -> bool:
        stripped = line.strip()
        match = KEY_VALUE_LINE_RE.match(stripped)
        if match:
            value = match.group('value').strip()
            if value and (
                '@' in value
                or sum(c.isdigit() for c in value) >= 4
                or (len(value.split()) >= 2 and not any(
                    _normalize_header_token(value) in _alias_tokens(aliases)
                    for aliases in FIELD_MAPPING.values()
                ))
            ):
                return False
            label = match.group('key').strip()
        else:
            label = stripped.split(':', 1)[0].strip()
        key = _normalize_header_token(label)
        if not key:
            return False
        if _canonical_header_key(label) in CANONICAL_FIELD_MAP:
            return True
        for aliases in FIELD_MAPPING.values():
            if key in _alias_tokens(aliases):
                return True
        return find_fuzzy_field_match(label) is not None

    def _strip_pasted_cell_value(self, line: str) -> str:
        stripped = line.rstrip('\t').strip()
        match = KEY_VALUE_LINE_RE.match(stripped)
        if match:
            return match.group('value').strip()
        return stripped

    def _reconstruct_stacked_table_paste(self, text: str) -> pd.DataFrame:
        """
        HTML tables copied from browsers often arrive as one cell per line (headers
        stacked vertically, then each data row stacked the same way). Rebuild a grid.
        """
        lines = [ln.rstrip('\t').strip() for ln in text.splitlines() if ln.strip()]
        if len(lines) < 4:
            return pd.DataFrame()

        header_end = 0
        while header_end < len(lines) and header_end < 12 and self._line_looks_like_header_label(lines[header_end]):
            header_end += 1
        if header_end < 2:
            return pd.DataFrame()

        headers = []
        for ln in lines[:header_end]:
            raw = self._strip_pasted_cell_value(ln)
            if ':' in raw and '@' not in raw and raw.index(':') < 24:
                headers.append(raw.split(':', 1)[0].strip())
            else:
                headers.append(raw)

        col_count = len(headers)
        data_lines = [self._strip_pasted_cell_value(ln) for ln in lines[header_end:]]
        rows: List[List[str]] = []
        idx = 0
        while idx < len(data_lines):
            chunk = data_lines[idx: idx + col_count]
            if not chunk:
                break
            row = chunk + [''] * max(0, col_count - len(chunk))
            rows.append(row[:col_count])
            idx += col_count

            while idx < len(data_lines):
                val = data_lines[idx]
                if '@' in val and ' ' not in val.strip():
                    break
                if sum(c.isdigit() for c in val) >= 4 and not any(ch.isalpha() for ch in val.replace('-', '')):
                    extra = data_lines[idx]
                    idx += 1
                    ext_col = next((i for i, h in enumerate(headers) if _normalize_header_token(h) == 'ext'), -1)
                    if ext_col >= 0 and not row[ext_col].strip():
                        row[ext_col] = extra
                    elif ext_col >= 0:
                        row[ext_col] = f"{row[ext_col]}\n{extra}".strip()
                    continue
                break

        if not rows:
            return pd.DataFrame()
        return pd.DataFrame(rows, columns=headers)

    def _is_good_dataframe(self, df: pd.DataFrame) -> bool:
        if df.empty:
            return False
        cols = [str(c).strip() for c in df.columns]
        all_keywords = [kw.lower() for sublist in FIELD_MAPPING.values() for kw in sublist]
        matches = sum(
            1 for c in cols
            if any(kw in _normalize_header_token(c) or _normalize_header_token(c) in kw for kw in all_keywords)
        )
        if matches >= 2:
            return True
        if any(sum(ch.isdigit() for ch in str(c)) >= 7 and '@' not in str(c) for c in cols):
            return False
        return any('@' in str(v) for _, row in df.iterrows() for v in row.tolist())

    def _row_echoes_header(self, headers: List[str], row: List[str]) -> bool:
        if not headers or not row:
            return False
        width = max(len(headers), len(row))
        matches = 0
        for i in range(width):
            h = _normalize_header_token(str(headers[i] if i < len(headers) else ''))
            c = _normalize_header_token(str(row[i] if i < len(row) else ''))
            if h and c and h == c:
                matches += 1
        return matches >= 2

    def _parse_delimited_section(self, lines: List[str], encoding: str) -> pd.DataFrame:
        if not lines:
            return pd.DataFrame()
        delimiter = self._detect_delimiter_from_lines(lines[:5])
        matrix_rows = [[c.strip() for c in ln.split(delimiter)] for ln in lines]
        df_temp = pd.DataFrame(matrix_rows)
        header_idx = self.find_header_row(df_temp)
        headers = [str(h).strip() for h in df_temp.iloc[header_idx].tolist()]
        data_rows = matrix_rows[header_idx + 1:]
        rows = []
        for row in data_rows:
            if self._row_echoes_header(headers, row):
                continue
            padded = row + [''] * max(0, len(headers) - len(row))
            rows.append(padded[: len(headers)])
        if not rows:
            return pd.DataFrame(columns=headers)
        return pd.DataFrame(rows, columns=headers)

    def _parse_plain_text_sections(self, text: str, encoding: str) -> pd.DataFrame:
        sections = self._split_text_sections(text)
        frames: List[pd.DataFrame] = []
        for section in sections:
            lines = [ln for ln in section.splitlines() if ln.strip()]
            if not lines:
                continue
            if self._is_key_value_section(lines):
                df = self._parse_key_value_section(lines)
            else:
                df = self._parse_delimited_section(lines, encoding)
            if not df.empty:
                frames.append(df)
        if not frames:
            return pd.DataFrame()
        return pd.concat(frames, ignore_index=True, sort=False)

    def _parse_vertical_txt(self, file_path: str, encoding: str) -> pd.DataFrame:
        """
        Parses TXT files using an 'Email Anchor' strategy
        Structure: Name -> Title -> Email -> Phone(s)
        """
        data = []
        try:
            with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                lines = f.readlines()

            # Clean and filter lines
            clean_lines = []
            for line in lines:
                if "DEVELOPER NOTE" in line:
                    break
                s = line.strip()
                if not s or s.startswith("#"):
                    continue
                norm = _normalize_header_token(s)
                if norm in ["nombre", "puesto", "correo", "ext", "usuario"]:
                    continue
                if self._is_vertical_section_title(s):
                    continue
                clean_lines.append(s)

            # Scan for emails and anchor around them
            i = 0
            while i < len(clean_lines):
                # Find next email
                email_idx = -1
                for j in range(i, min(i + 12, len(clean_lines))):
                    if self._looks_like_email(clean_lines[j]):
                        email_idx = j
                        break

                if email_idx == -1:
                    break  # No more emails

                # Extract fields relative to email
                name = ""
                title = ""

                if email_idx >= 2:
                    title = self._strip_labeled_value(clean_lines[email_idx - 1])
                    name = self._strip_labeled_value(clean_lines[email_idx - 2])
                elif email_idx == 1:
                    name = self._strip_labeled_value(clean_lines[email_idx - 1])

                email = self._strip_labeled_value(clean_lines[email_idx])

                # Extract phones after email
                p_idx = email_idx + 1
                raw_phones = []
                while p_idx < len(clean_lines):
                    val = self._strip_labeled_value(clean_lines[p_idx])
                    digit_count = sum(c.isdigit() for c in val)
                    if digit_count >= 4:
                        raw_phones.append(val)
                        p_idx += 1
                    else:
                        break

                # Process phones
                work_phone = ""
                mobile_phone = ""
                work_phone_ext = ""

                for p in raw_phones:
                    digits = "".join(filter(str.isdigit, p))

                    if len(digits) < 8:
                        work_phone_ext = p
                    else:
                        # Heuristic: Mobile usually starts with 6, 7, 8 in Costa Rica
                        if digits.startswith(('6', '7', '8')):
                            mobile_phone = p
                        else:
                            work_phone = p

                record = {
                    "first_name": name,
                    "business_title": title,
                    "email": email,
                    "work_phone": work_phone,
                    "mobile_phone": mobile_phone,
                    "work_phone_ext": work_phone_ext
                }
                data.append(record)

                # Advance index
                i = p_idx

            return pd.DataFrame(data)

        except Exception as e:
            logger.error(f"Error parsing vertical TXT: {e}")
            return pd.DataFrame()

    # --- vCard (.vcf) -------------------------------------------------------

    def _vcf_logical_lines(self, text: str) -> List[str]:
        """Split raw vCard text into logical lines, applying line unfolding:
        whitespace-folded continuations (3.0/4.0, next line starts with a space
        or tab) and quoted-printable soft breaks (2.1, line ends with '=') are
        rejoined."""
        lines: List[str] = []
        for raw in re.split(r'\r\n|\r|\n', text):
            if raw == '':
                continue
            if lines and raw[0] in (' ', '\t'):
                lines[-1] += raw[1:]
            elif (
                lines
                and lines[-1].endswith('=')
                and 'QUOTED-PRINTABLE' in lines[-1].split(':', 1)[0].upper()
            ):
                # 2.1 quoted-printable soft break: the trailing '=' marks the
                # fold and is not part of the value.
                lines[-1] = lines[-1][:-1] + (raw[1:] if raw[:1] in (' ', '\t') else raw)
            else:
                lines.append(raw)
        return lines

    @staticmethod
    def _vcf_split_unescaped(value: str, sep: str) -> List[str]:
        """Split on `sep` occurrences not escaped with a backslash (escapes are
        kept in the parts; _vcf_unescape resolves them afterwards)."""
        parts: List[str] = []
        current: List[str] = []
        escaped = False
        for ch in value:
            if escaped:
                current.append('\\')
                current.append(ch)
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == sep:
                parts.append(''.join(current))
                current = []
            else:
                current.append(ch)
        if escaped:
            current.append('\\')
        parts.append(''.join(current))
        return parts

    @staticmethod
    def _vcf_unescape(value: str) -> str:
        """vCard text escapes: \\n / \\N -> newline; \\, \\; \\\\ -> literal char."""
        return re.sub(
            r'\\(.)',
            lambda m: '\n' if m.group(1) in ('n', 'N') else m.group(1),
            value,
        )

    @staticmethod
    def _vcf_qp_decode(value: str, charset: str = None) -> str:
        """Decode a QUOTED-PRINTABLE value (vCard 2.1) honouring CHARSET=
        (utf-8, iso-8859-1/latin-1 and unknown-label fallbacks)."""
        raw = quopri.decodestring(value.encode('latin-1', errors='replace'))
        candidates = ([charset] if charset else []) + ['utf-8', 'latin-1']
        for enc in candidates:
            try:
                return raw.decode(enc)
            except (LookupError, UnicodeDecodeError):
                continue
        return raw.decode('utf-8', errors='replace')

    def _vcf_parse_property(self, line: str):
        """Parse one logical vCard line into (name, left, types, params, value).
        Supports both 3.0/4.0 params (`TEL;TYPE=WORK,CELL:...`) and 2.1 bare
        tokens (`TEL;WORK;CELL:...`). `value` is QP-decoded but still
        text-escaped; structured splitting/unescaping happens per property."""
        left, sep, raw_value = line.partition(':')
        if not sep:
            return None
        segments = left.split(';')
        name = segments[0].strip().upper()
        if not name:
            return None
        types: List[str] = []
        params = {}
        encoding = None
        charset = None
        for seg in segments[1:]:
            seg = seg.strip()
            if not seg:
                continue
            if '=' in seg:
                key, _, val = seg.partition('=')
                key, val = key.strip().upper(), val.strip()
                if key == 'TYPE':
                    types.extend(t.strip().upper() for t in val.split(',') if t.strip())
                elif key == 'ENCODING':
                    encoding = val.upper()
                elif key == 'CHARSET':
                    charset = val
                else:
                    params[key] = val
            else:
                token = seg.upper()
                if token == 'QUOTED-PRINTABLE':
                    encoding = 'QUOTED-PRINTABLE'
                elif token in ('BASE64', 'B'):
                    encoding = 'BASE64'
                else:
                    types.append(token)
        value = raw_value
        if encoding == 'QUOTED-PRINTABLE':
            value = self._vcf_qp_decode(raw_value, charset)
        return name, left, types, params, value

    def _vcf_assign_tel(self, record, unmapped, left, types, params, value):
        """Map a TEL property: CELL -> mobile_phone, WORK/VOICE/untyped ->
        work_phone, HOME/FAX/PAGER -> unmapped (no canonical field exists).
        Extension hints come from an EXT= param or an "ext. 123" suffix."""
        number = self._vcf_unescape(value).strip()
        ext = params.get('EXT') or params.get('X-EXTENSION')
        match = VCF_EXT_SUFFIX_RE.search(number)
        if match:
            ext = ext or match.group(1)
            number = number[:match.start()].rstrip(' ,;')
        type_set = set(types)
        if 'CELL' in type_set:
            target = 'mobile_phone'
        elif type_set & {'HOME', 'FAX', 'PAGER'}:
            target = None
        else:
            target = 'work_phone'
        if target and number and target not in record:
            record[target] = number
            if ext and 'work_phone_ext' not in record:
                record['work_phone_ext'] = ext
        else:
            line = f"{left}: {number}"
            if ext:
                line += f" ext. {ext}"
            unmapped.append(line)

    def _vcf_assign_adr(self, record, unmapped, left, types, value):
        """Map an ADR property (po;ext;street;city;region;code;country):
        TYPE=WORK -> business_address_*, HOME/untyped -> address_*."""
        parts = [self._vcf_unescape(p).strip() for p in self._vcf_split_unescaped(value, ';')]
        parts += [''] * max(0, 7 - len(parts))
        prefix = 'business_address' if 'WORK' in set(types) else 'address'
        mapping = {
            f'{prefix}_street': ', '.join(p for p in parts[0:3] if p),
            f'{prefix}_city': parts[3],
            f'{prefix}_state': parts[4],
            f'{prefix}_postal': parts[5],
            f'{prefix}_country': parts[6],
        }
        placed = False
        for field, val in mapping.items():
            if val and field not in record:
                record[field] = val
                placed = True
        if not placed:
            unmapped.append(f"{left}: {self._vcf_unescape(value).strip()}")

    def _parse_vcf_card(self, properties) -> dict:
        """Map one VCARD's properties onto canonical snake_case field ids.
        Anything without a canonical home is kept as a 'NAME;PARAMS: value'
        line in the vcf_unmapped column (-> record `extra`, never dropped)."""
        record = {}
        unmapped: List[str] = []

        def assign(field: str, value: str) -> bool:
            value = (value or '').strip()
            if value and field not in record:
                record[field] = value
                return True
            return False

        for name, left, types, params, value in properties:
            if name in VCF_IGNORED_PROPERTIES:
                continue
            if name in VCF_MEDIA_PROPERTIES:
                unmapped.append(f"{left}: <media omitted>")
                continue
            if name == 'N':
                parts = [self._vcf_unescape(p).strip() for p in self._vcf_split_unescaped(value, ';')]
                family = parts[0] if len(parts) > 0 else ''
                given = parts[1] if len(parts) > 1 else ''
                middle = parts[2] if len(parts) > 2 else ''
                assign('last_name', family)
                assign('first_name', ' '.join(p for p in (given, middle) if p))
            elif name == 'FN':
                assign('full_name', self._vcf_unescape(value))
            elif name == 'ORG':
                units = [self._vcf_unescape(p).strip() for p in self._vcf_split_unescaped(value, ';')]
                if units:
                    assign('business_name', units[0])
                    assign('business_department', '; '.join(u for u in units[1:] if u))
            elif name == 'TITLE':
                assign('business_title', self._vcf_unescape(value))
            elif name == 'TEL':
                self._vcf_assign_tel(record, unmapped, left, types, params, value)
            elif name == 'EMAIL':
                if not assign('email', self._vcf_unescape(value)):
                    unmapped.append(f"{left}: {self._vcf_unescape(value).strip()}")
            elif name == 'ADR':
                self._vcf_assign_adr(record, unmapped, left, types, value)
            elif name == 'URL':
                target = 'personal_url' if set(types) & {'HOME', 'PERSONAL'} else 'business_url'
                if not assign(target, self._vcf_unescape(value)):
                    unmapped.append(f"{left}: {self._vcf_unescape(value).strip()}")
            elif name == 'NOTE':
                if not assign('personal_bio', self._vcf_unescape(value)):
                    unmapped.append(f"{left}: {self._vcf_unescape(value).strip()}")
            elif name == 'BDAY':
                if not assign('personal_birthday', self._vcf_unescape(value)):
                    unmapped.append(f"{left}: {self._vcf_unescape(value).strip()}")
            elif name == 'X-EXTENSION':
                if not assign('work_phone_ext', self._vcf_unescape(value)):
                    unmapped.append(f"{left}: {self._vcf_unescape(value).strip()}")
            else:
                unmapped.append(f"{left}: {self._vcf_unescape(value).strip()}")

        if 'full_name' not in record:
            assembled = ' '.join(
                p for p in (record.get('first_name'), record.get('last_name')) if p
            )
            if assembled:
                record['full_name'] = assembled
        if unmapped:
            record[VCF_UNMAPPED_COLUMN] = '\n'.join(unmapped)

        # Stable column order (canonical ids first) so this parser and the demo
        # parser emit identical tables.
        ordered = {k: record[k] for k in FIELD_MAPPING if k in record}
        if VCF_UNMAPPED_COLUMN in record:
            ordered[VCF_UNMAPPED_COLUMN] = record[VCF_UNMAPPED_COLUMN]
        return ordered

    def _parse_vcf(self, file_path: str, encoding: str) -> pd.DataFrame:
        """Parse a .vcf file (vCard 2.1/3.0/4.0) into one row per VCARD, with
        canonical field ids as columns so the standard map_row pipeline
        (alias match, phone/name normalization, extra retention) applies
        unchanged. A truncated final card without END:VCARD is still emitted
        best-effort."""
        with open(file_path, 'r', encoding=encoding, errors='replace') as f:
            text = f.read()
        cards = []
        current = None
        for line in self._vcf_logical_lines(text):
            tag = line.strip().upper()
            if tag == 'BEGIN:VCARD':
                current = []
            elif tag == 'END:VCARD':
                if current is not None:
                    cards.append(current)
                current = None
            elif current is not None:
                prop = self._vcf_parse_property(line)
                if prop:
                    current.append(prop)
        if current:
            cards.append(current)
        records = [r for r in (self._parse_vcf_card(card) for card in cards) if r]
        if not records:
            return pd.DataFrame()
        return pd.DataFrame(records)

    def parse_file(self, file_path: str) -> pd.DataFrame:
        """
        Parse file based on extension
        Returns: pandas DataFrame
        """
        ext = os.path.splitext(file_path)[1].lower()
        encoding = self.detect_encoding(file_path)

        try:
            if ext == '.csv':
                # Detect the header row the same way Excel does below — real-world CSV
                # exports routinely have a title/preamble row (e.g. "BASE DE DATOS") or
                # blank rows before the actual column headers, which would otherwise be
                # misread as the header itself.
                df_temp = self._read_raw_matrix(file_path, encoding, delimiter=',')
                header_idx = self.find_header_row(df_temp)
                logger.debug(f"Reading CSV with header at row {header_idx}")
                df = pd.read_csv(file_path, encoding=encoding, header=header_idx)

            elif ext in ['.xls', '.xlsx']:
                # Try openpyxl first, fallback to xlrd
                try:
                    df_temp = pd.read_excel(file_path, engine='openpyxl', header=None)
                except Exception:
                    df_temp = pd.read_excel(file_path, engine='xlrd', header=None)

                if self._is_transposed_matrix(df_temp):
                    # Transposed layout: headers down column A, one contact per
                    # column B+. Transpose once, then run the standard header-row
                    # pipeline on the flipped matrix (no re-read needed).
                    logger.info("Detected transposed Excel layout (headers in column A)")
                    df_temp = df_temp.transpose().reset_index(drop=True)
                    header_idx = self.find_header_row(df_temp)
                    logger.debug(f"Reading transposed Excel with header at row {header_idx}")
                    headers = [
                        str(v).strip() if pd.notna(v) and str(v).strip() else f"Unnamed: {i}"
                        for i, v in enumerate(df_temp.iloc[header_idx].tolist())
                    ]
                    df = df_temp.iloc[header_idx + 1:].copy()
                    df.columns = headers
                    df = df.reset_index(drop=True)
                else:
                    # Find header row
                    header_idx = self.find_header_row(df_temp)
                    logger.debug(f"Reading Excel with header at row {header_idx}")

                    # Re-read with correct header
                    try:
                        df = pd.read_excel(file_path, engine='openpyxl', header=header_idx)
                    except Exception:
                        df = pd.read_excel(file_path, engine='xlrd', header=header_idx)

            elif ext in ['.txt', '.md']:
                with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                    raw_text = f.read()
                lines = [ln for ln in raw_text.splitlines() if ln.strip()]

                # Pasted tabular text (TSV/CSV) must not go through the vertical
                # email-anchor parser — it mis-identifies the header row as a name.
                if self._looks_like_tabular_text(lines) or self._is_key_value_section(lines):
                    df = self._parse_plain_text_sections(raw_text, encoding)
                    if not self._is_good_dataframe(df):
                        stacked = self._reconstruct_stacked_table_paste(raw_text)
                        if not stacked.empty:
                            df = stacked
                else:
                    df = self._parse_vertical_txt(file_path, encoding)
                    if df.empty:
                        stacked = self._reconstruct_stacked_table_paste(raw_text)
                        if not stacked.empty:
                            df = stacked
                    if df.empty:
                        delimiter = self._detect_delimiter(file_path, encoding)
                        df_temp = self._read_raw_matrix(file_path, encoding, delimiter=delimiter)
                        header_idx = self.find_header_row(df_temp)
                        logger.debug(f"Reading TXT with delimiter {delimiter!r}, header at row {header_idx}")
                        df = pd.read_csv(
                            file_path, encoding=encoding, sep=delimiter, header=header_idx, engine='python'
                        )

            elif ext == '.json':
                with open(file_path, 'r', encoding=encoding) as f:
                    data = json.load(f)
                df = pd.DataFrame(data)

            elif ext == '.vcf':
                df = self._parse_vcf(file_path, encoding)

            else:
                logger.warning(f"Unsupported file type: {ext}")
                return pd.DataFrame()

            logger.info(f"✅ Parsed {len(df)} rows from {os.path.basename(file_path)}")
            return df

        except Exception as e:
            logger.error(f"Error parsing file: {e}")
            return pd.DataFrame()
