#!/usr/bin/env python3
"""
Regression tests for batch-parsing flexibility fixes:
  - Fuzzy header fallback (label mismatches) in DataNormalizer / BatchParser.map_row
  - Value-based phone <-> extension reconciliation
  - CSV/TXT header-row detection and delimiter auto-detection in FileParser

Run inside the api-server container (pandas/phonenumbers/nameparser are only
installed there, not on the host):

    docker compose -f docker-compose.dev.yml exec -T api-server \
      sh -c "cd /app/batch-parsing && python3 -m unittest test_batch_parsing -v"
"""

import os
import tempfile
import unittest

import pandas as pd

from data_normalizer import DataNormalizer, find_fuzzy_field_match
from file_parser import FileParser
from parser import BatchParser


class FuzzyFieldMatchTests(unittest.TestCase):
    def test_label_variant_maps_to_known_field(self):
        self.assertEqual(find_fuzzy_field_match("telefono oficina 2"), "work_phone")

    def test_short_alias_requires_exact_token(self):
        # "ext" is a real alias token; "extension" header token should hit it directly.
        self.assertEqual(find_fuzzy_field_match("numero de extension"), "work_phone_ext")

    def test_unrelated_short_word_does_not_match(self):
        # "fax" isn't in FIELD_MAPPING at all and is too short for substring fuzzing.
        self.assertIsNone(find_fuzzy_field_match("fax"))

    def test_ambiguous_compound_header_returns_none(self):
        # Both "nombre" (first_name) and "apellido" (last_name) tokens present ->
        # ambiguous; caller's own name-splitting fallback should handle this instead.
        self.assertIsNone(find_fuzzy_field_match("nombre y apellido"))

    def test_exact_alias_header_is_not_needed_here(self):
        # Sanity: a header that already matches exactly still resolves via fuzzy path
        # too (single token = the alias itself), since map_row only calls this for
        # headers the exact pass didn't already claim.
        self.assertEqual(find_fuzzy_field_match("celular"), "mobile_phone")


class PhoneExtensionReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.normalizer = DataNormalizer()

    def test_swapped_values_are_swapped_back(self):
        mapped = {"work_phone": "105", "work_phone_ext": "22334455"}
        self.normalizer.reconcile_phone_and_extension(mapped)
        self.assertEqual(mapped["work_phone"], "22334455")
        self.assertEqual(mapped["work_phone_ext"], "105")

    def test_short_phone_with_no_extension_moves_to_extension(self):
        mapped = {"work_phone": "105", "work_phone_ext": None}
        self.normalizer.reconcile_phone_and_extension(mapped)
        self.assertIsNone(mapped["work_phone"])
        self.assertEqual(mapped["work_phone_ext"], "105")

    def test_long_extension_with_no_phone_moves_to_phone(self):
        mapped = {"work_phone": None, "work_phone_ext": "22334455"}
        self.normalizer.reconcile_phone_and_extension(mapped)
        self.assertEqual(mapped["work_phone"], "22334455")
        self.assertIsNone(mapped["work_phone_ext"])

    def test_ambiguous_middle_length_left_alone(self):
        mapped = {"work_phone": "123456", "work_phone_ext": None}
        self.normalizer.reconcile_phone_and_extension(mapped)
        self.assertEqual(mapped["work_phone"], "123456")
        self.assertIsNone(mapped["work_phone_ext"])

    def test_e164_phone_never_touched(self):
        mapped = {"work_phone": "+50622334455", "work_phone_ext": "105"}
        self.normalizer.reconcile_phone_and_extension(mapped)
        self.assertEqual(mapped["work_phone"], "+50622334455")
        self.assertEqual(mapped["work_phone_ext"], "105")

    def test_both_normal_shapes_left_alone(self):
        mapped = {"work_phone": "22334455", "work_phone_ext": "105"}
        self.normalizer.reconcile_phone_and_extension(mapped)
        self.assertEqual(mapped["work_phone"], "22334455")
        self.assertEqual(mapped["work_phone_ext"], "105")


def _make_batch_parser() -> BatchParser:
    return BatchParser(
        batch_id="00000000-0000-0000-0000-000000000000",
        file_path="unused",
        postgres_url="postgresql://unused",
        cassandra_hosts=["unused"],
        storage_mode="local",
    )


class MapRowIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.parser = _make_batch_parser()

    def test_swapped_phone_and_extension_reconciled(self):
        row = pd.Series({
            "Nombre": "Sofia Rodriguez",
            "Correo": "sofia@example.com",
            "Telefono": "105",
            "Ext": "22334455",
        })
        mapped = self.parser.map_row(row)
        # Reconciliation moves the 8-digit value into work_phone, which then goes
        # through the normal normalize_phone formatting (no country code configured).
        self.assertEqual(mapped["work_phone"], "2233-4455")
        self.assertEqual(mapped["work_phone_ext"], "105")

    def test_mismatched_label_still_maps_via_fuzzy_fallback(self):
        row = pd.Series({
            "Nombre": "Ana Gomez",
            "Correo Electronico": "ana@example.com",
            "Telefono Oficina 2": "22221111",
        })
        mapped = self.parser.map_row(row)
        self.assertEqual(mapped["email"], "ana@example.com")
        self.assertEqual(mapped["work_phone"], "2222-1111")

    def test_fuzzy_fallback_never_overwrites_exact_match(self):
        row = pd.Series({
            "Phone": "22221111",
            "Telefono Oficina": "88889999",
        })
        mapped = self.parser.map_row(row)
        # "Phone" (exact alias) is claimed first by iteration over FIELD_MAPPING;
        # the second work_phone-shaped header must not silently overwrite it.
        self.assertEqual(mapped["work_phone"], "2222-1111")


class FileParserFlexibilityTests(unittest.TestCase):
    def setUp(self):
        self.parser = FileParser()
        self._tmp_paths = []

    def tearDown(self):
        for p in self._tmp_paths:
            try:
                os.unlink(p)
            except OSError:
                pass

    def _write_tmp(self, content: str, suffix: str) -> str:
        fd, path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        self._tmp_paths.append(path)
        return path

    def test_csv_with_preamble_row_skips_to_real_header(self):
        content = (
            "BASE DE DATOS GENERAL\n"
            "Nombre,Correo,Telefono\n"
            "Sofia Rodriguez,sofia@example.com,22334455\n"
        )
        path = self._write_tmp(content, ".csv")
        df = self.parser.parse_file(path)
        self.assertIn("Nombre", df.columns)
        self.assertEqual(df.iloc[0]["Nombre"], "Sofia Rodriguez")

    def test_pasted_semicolon_text_is_detected_and_parsed(self):
        # Simulates pasting a semicolon-delimited (locale) table as plain text.
        content = "Nombre;Correo;Telefono\nAna Gomez;ana@example.com;22221111\n"
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertIn("Nombre", df.columns)
        self.assertEqual(df.iloc[0]["Correo"], "ana@example.com")

    def test_pasted_comma_text_is_detected_and_parsed(self):
        content = "Nombre,Correo,Telefono\nAna Gomez,ana@example.com,22221111\n"
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertIn("Nombre", df.columns)
        self.assertEqual(df.iloc[0]["Telefono"], 22221111)


if __name__ == "__main__":
    unittest.main()
