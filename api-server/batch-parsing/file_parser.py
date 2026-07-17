"""
File Parser Module
Handles parsing of various file formats: CSV, XLS, XLSX, TXT, JSON
Extracted from __script_v9.py
"""

import csv
import os
import json
import logging
import re
import unicodedata
from typing import List

import pandas as pd
import chardet

from data_normalizer import FIELD_MAPPING, _normalize_header_token

logger = logging.getLogger(__name__)

KEY_VALUE_LINE_RE = re.compile(r'^\s*(?P<key>[^:]+?)\s*:\s*(?P<value>.+?)\s*$')


class FileParser:
    """
    Parses various file formats into pandas DataFrames
    Supports: CSV, XLS, XLSX, TXT, JSON
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

    def find_header_row(self, df: pd.DataFrame) -> int:
        """
        Scans the first few rows to find the one that best matches field mapping
        Returns the index of the header row
        """
        max_matches = 0
        header_idx = 0

        # Flatten mapping values for easy lookup
        all_keywords = [kw.lower() for sublist in FIELD_MAPPING.values() for kw in sublist]

        # Check first 20 rows
        for i in range(min(20, len(df))):
            row_values = []
            for val in df.iloc[i]:
                if pd.notna(val):
                    val_str = str(val).lower().strip()
                    # Remove accents for better matching
                    val_normalized = ''.join(
                        c for c in unicodedata.normalize('NFD', val_str)
                        if unicodedata.category(c) != 'Mn'
                    )
                    row_values.append(val_normalized)

            # Count matches
            matches = sum(1 for val in row_values if any(kw in val or val in kw for kw in all_keywords))

            if matches > max_matches:
                max_matches = matches
                header_idx = i

        if max_matches == 0:
            logger.warning("Could not confidently detect header row. Assuming row 0.")
            return 0

        logger.debug(f"Found header row at index {header_idx} with {max_matches} matches")
        return header_idx

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
        sections = [s.strip() for s in re.split(r'\n\s*\n+', cleaned) if s.strip()]
        return sections if sections else [cleaned]

    def _is_key_value_section(self, lines: List[str]) -> bool:
        non_empty = [ln for ln in lines if ln.strip()]
        if not non_empty:
            return False
        kv_count = sum(1 for ln in non_empty if KEY_VALUE_LINE_RE.match(ln.strip()))
        return kv_count >= 2 and kv_count / len(non_empty) >= 0.6

    def _parse_key_value_section(self, lines: List[str]) -> pd.DataFrame:
        headers: List[str] = []
        values: List[str] = []
        for line in lines:
            match = KEY_VALUE_LINE_RE.match(line.strip())
            if not match:
                continue
            headers.append(match.group('key').strip())
            values.append(match.group('value').strip())
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
                if s and not s.startswith("#") and s not in ["Nombre", "Puesto", "Correo", "Ext"]:
                    clean_lines.append(s)

            # Scan for emails and anchor around them
            i = 0
            while i < len(clean_lines):
                # Find next email
                email_idx = -1
                for j in range(i, min(i + 10, len(clean_lines))):
                    if "@" in clean_lines[j] and " " not in clean_lines[j]:
                        email_idx = j
                        break

                if email_idx == -1:
                    break  # No more emails

                # Extract fields relative to email
                name = ""
                title = ""

                if email_idx >= 2:
                    title = clean_lines[email_idx - 1]
                    name = clean_lines[email_idx - 2]
                elif email_idx == 1:
                    name = clean_lines[email_idx - 1]

                email = clean_lines[email_idx]

                # Extract phones after email
                p_idx = email_idx + 1
                raw_phones = []
                while p_idx < len(clean_lines):
                    val = clean_lines[p_idx]
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

                # Find header row
                header_idx = self.find_header_row(df_temp)
                logger.debug(f"Reading Excel with header at row {header_idx}")

                # Re-read with correct header
                try:
                    df = pd.read_excel(file_path, engine='openpyxl', header=header_idx)
                except Exception:
                    df = pd.read_excel(file_path, engine='xlrd', header=header_idx)

            elif ext == '.txt':
                with open(file_path, 'r', encoding=encoding, errors='replace') as f:
                    raw_text = f.read()
                lines = [ln for ln in raw_text.splitlines() if ln.strip()]

                # Pasted tabular text (TSV/CSV) must not go through the vertical
                # email-anchor parser — it mis-identifies the header row as a name.
                if self._looks_like_tabular_text(lines) or self._is_key_value_section(lines):
                    df = self._parse_plain_text_sections(raw_text, encoding)
                else:
                    df = self._parse_vertical_txt(file_path, encoding)
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

            else:
                logger.warning(f"Unsupported file type: {ext}")
                return pd.DataFrame()

            logger.info(f"✅ Parsed {len(df)} rows from {os.path.basename(file_path)}")
            return df

        except Exception as e:
            logger.error(f"Error parsing file: {e}")
            return pd.DataFrame()
