"""
File Parser Module
Handles parsing of various file formats: CSV, XLS, XLSX, TXT, JSON
Extracted from __script_v9.py
"""

import os
import json
import logging
import unicodedata
from typing import List

import pandas as pd
import chardet

from data_normalizer import FIELD_MAPPING

logger = logging.getLogger(__name__)

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
                df = pd.read_csv(file_path, encoding=encoding)

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
                # Try vertical format first
                df = self._parse_vertical_txt(file_path, encoding)
                if df.empty:
                    # Fallback to CSV-like parsing
                    df = pd.read_csv(file_path, encoding=encoding, sep='\t')

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
