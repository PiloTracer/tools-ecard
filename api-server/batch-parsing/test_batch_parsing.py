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

from data_normalizer import (
    DataNormalizer,
    CANONICAL_FIELD_MAP,
    _canonical_header_key,
    find_fuzzy_field_match,
)
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


class CanonicalFieldMatchTests(unittest.TestCase):
    """Semantics: vCard field names are matched regardless of case and of `_` vs spaces."""

    def test_canonical_key_ignores_case_underscore_spaces(self):
        for variant in (
            "Business Address Street",
            "BUSINESS_ADDRESS_STREET",
            "business address street",
            "Business Address_Street",
        ):
            self.assertEqual(
                _canonical_header_key(variant), "business_address_street", variant
            )

    def test_canonical_map_covers_all_field_ids(self):
        import data_normalizer as dn

        for field in dn.FIELD_MAPPING:
            self.assertEqual(
                CANONICAL_FIELD_MAP.get(field),
                field,
                msg=f"canonical map missing {field!r}",
            )

    def test_map_row_spaced_headers_cover_full_vcard_set(self):
        row = pd.Series({
            "Business Address Street": "456 Business Ave",
            "Business Hours": "Mon-Fri 9AM",
            "Social Instagram": "@acme",
            "Personal URL": "https://acme.com",
            "Birthday": "1990-05-15",
            "LinkedIn": "linkedin.com/in/acme",
            "Company Twitter": "@acme_tw",
        })
        mapped = _make_batch_parser().map_row(row)
        self.assertEqual(mapped["business_address_street"], "456 Business Ave")
        self.assertEqual(mapped["business_hours"], "Mon-Fri 9Am")
        self.assertEqual(mapped["social_instagram"], "@acme")
        self.assertEqual(mapped["personal_url"], "https://acme.com")
        self.assertEqual(mapped["personal_birthday"], "1990-05-15")
        self.assertEqual(mapped["business_linkedin"], "linkedin.com/in/acme")
        self.assertEqual(mapped["business_twitter"], "@Acme_Tw")

    def test_map_row_underscore_variant_equals_spaced_variant(self):
        spaced = _make_batch_parser().map_row(pd.Series({
            "Business Address Street": "456 Business Ave",
        }))
        underscored = _make_batch_parser().map_row(pd.Series({
            "BUSINESS_ADDRESS_STREET": "456 Business Ave",
        }))
        self.assertEqual(spaced["business_address_street"], "456 Business Ave")
        self.assertEqual(underscored["business_address_street"], "456 Business Ave")


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
        self.assertEqual(str(df.iloc[0]["Telefono"]), "22221111")

    def test_key_value_paste_is_parsed(self):
        content = (
            "nombre: Pilo Montaneno Pulmoclas\n"
            "puesto: Manager\n"
            "telefono: 12341234\n"
            "whatsapp: 12341234\n"
            "website: www.logicbison.com\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["nombre"], "Pilo Montaneno Pulmoclas")
        self.assertEqual(df.iloc[0]["website"], "www.logicbison.com")

    def test_key_value_paste_without_colons_tabs(self):
        # vCard field-name paste with tab separators instead of "label: value".
        content = (
            "full_name\tJohn Doe\n"
            "first_name\tJohn\n"
            "last_name\tDoe\n"
            "work_phone\t+506 2222-1234\n"
            "work_phone_ext\t123\n"
            "mobile_phone\t+506 8888-9999\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["full_name"], "John Doe")
        self.assertEqual(df.iloc[0]["work_phone"], "+506 2222-1234")
        self.assertEqual(df.iloc[0]["mobile_phone"], "+506 8888-9999")

    def test_key_value_paste_without_colons_spaces(self):
        # Same paste layout but aligned with multiple spaces instead of tabs.
        content = (
            "full_name    John Doe\n"
            "work_phone    +506 2222-1234\n"
            "mobile_phone    +506 8888-9999\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["full_name"], "John Doe")
        self.assertEqual(df.iloc[0]["work_phone"], "+506 2222-1234")

    def test_tsv_with_alias_only_header_row_stays_tabular(self):
        # Both cells of the header line are known aliases — must NOT be read as a
        # key-value line ("full_name" -> "email"); it is a real 2-column table.
        content = "full_name\temail\nJohn Doe\tjohn@example.com\n"
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(list(df.columns), ["full_name", "email"])
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["full_name"], "John Doe")
        self.assertEqual(df.iloc[0]["email"], "john@example.com")

    def test_tabular_paste_does_not_use_vertical_parser(self):
        content = (
            "Nombre\tPuesto\tCorreo\tExt\n"
            "Camila Castro Cordero\tAsistente de Ingeniería\tccastro@code-cr.com\t2459-7578\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertIn("Nombre", df.columns)
        self.assertEqual(df.iloc[0]["Correo"], "ccastro@code-cr.com")
        self.assertNotEqual(str(df.iloc[0]["Nombre"]).strip(), "Nombre")

    def test_multi_section_paste_merges_rows(self):
        content = (
            "Nombre\tPuesto\tCorreo\tNumero de teléfono\n"
            "Jimena Rojas Arias\tAuxiliar de compras\tjrojas@code-cr.com\t2459-6068\n"
            "\n"
            "Nombre\tPuesto\tCorreo\tExt\n"
            "Brandon Alvarez Quiros\tAuxiliar de Logistica y Compras\tbalavez@code-cr.com\t6088\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(len(df), 2)
        self.assertEqual(df.iloc[1]["Correo"], "balavez@code-cr.com")

    def test_usuario_header_alias(self):
        content = (
            "usuario\tPuesto\tCorreo\text\n"
            "Natalia Sandi Flores\tAuxiliar de Tesorería\tnsandi@code-cr.com\t6064\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        mapped = _make_batch_parser().map_row(df.iloc[0])
        self.assertEqual(mapped["email"], "nsandi@code-cr.com")
        self.assertIn("Natalia", mapped["full_name"] or mapped["first_name"] or "")

    def test_vertical_stacked_paste(self):
        content = (
            "Damark Beale Nelson\n"
            "Ingeniero Aseguramiento Calidad\n"
            "dbeale@code-cr.com\n"
            "2459-7569\n"
            "8640-2373\n"
            "\n"
            "Gustavo Alpizar Hidalgo\n"
            "Gerente de Proyecto Electromecánico\n"
            "galpizar@code-cr.com\n"
            "2459-7569\n"
            "8865-2411\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertGreaterEqual(len(df), 2)
        emails = [str(v) for v in df["email"].tolist()] if "email" in df.columns else []
        if not emails:
            mapped = [_make_batch_parser().map_row(row) for _, row in df.iterrows()]
            emails = [m.get("email") for m in mapped]
        self.assertIn("dbeale@code-cr.com", emails)
        self.assertIn("galpizar@code-cr.com", emails)

    def test_messy_html_table_paste_one_cell_per_line(self):
        content = (
            "Nombre\nPuesto\nCorreo\nExt\n"
            "Nombre: Pablo López Moreira\n"
            "Gerente de Operaciones y Facilidades\n"
            "plopez@code-cr.com\n"
            "24596057\n"
            "86729333\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        mapped = _make_batch_parser().map_row(df.iloc[0])
        self.assertEqual(mapped["email"], "plopez@code-cr.com")
        self.assertIn("Pablo", mapped["full_name"] or mapped["first_name"] or "")

    def test_operator_feedback_samples(self):
        import json

        fixtures_path = os.path.join(os.path.dirname(__file__), "fixtures", "operator_batch_samples.json")
        with open(fixtures_path, encoding="utf-8") as f:
            samples = json.load(f)

        # Paste creates a .txt upload; operators may also save each sample as
        # .txt or .md — every record must survive every path.
        for ext in (".txt", ".md"):
            for sample in samples:
                with self.subTest(sample_id=sample["id"], ext=ext):
                    path = self._write_tmp(sample["text"], ext)
                    df = self.parser.parse_file(path)
                    self.assertEqual(
                        len(df),
                        sample["expectedCount"],
                        msg=f"sample #{sample['id']} [{ext}] produced {len(df)} rows, "
                            f"expected {sample['expectedCount']}",
                    )
                    mapped_rows = [_make_batch_parser().map_row(row) for _, row in df.iterrows()]
                    emails = [m.get("email") for m in mapped_rows]
                    for expected_email in sample["emails"]:
                        self.assertIn(expected_email, emails)
                    names = [m.get("full_name") or "" for m in mapped_rows]
                    for expected_name in sample["expectedNames"]:
                        self.assertIn(
                            expected_name,
                            names,
                            msg=f"sample #{sample['id']} [{ext}] missing record {expected_name!r}",
                        )
                    if sample["id"] in (1, 6):
                        pablo = next(m for m in mapped_rows if m.get("email") == "plopez@code-cr.com")
                        self.assertEqual("Pablo López Moreira", pablo.get("full_name") or "")
                        self.assertNotIn("Nombre:", pablo.get("full_name") or "")

    def test_md_extension_parsed_like_txt(self):
        content = "Nombre\tCorreo\nAna Gomez\tana@example.com\n"
        path = self._write_tmp(content, ".md")
        df = self.parser.parse_file(path)
        self.assertEqual(df.iloc[0]["Correo"], "ana@example.com")


class WorkPhonePrefixPolicyTests(unittest.TestCase):
    def setUp(self):
        self.normalizer = DataNormalizer()

    def test_four_digit_ext_becomes_prefixed_work_phone(self):
        mapped = {"work_phone": None, "work_phone_ext": "6088"}
        self.normalizer.apply_work_phone_prefix_policy(mapped, "2459")
        self.assertEqual(mapped["work_phone"], "24596088")
        self.assertIsNone(mapped["work_phone_ext"])


class MapRowPrefixIntegrationTests(unittest.TestCase):
    def test_ext_short_number_gets_work_phone_prefix_on_map(self):
        parser = BatchParser(
            batch_id="00000000-0000-0000-0000-000000000000",
            file_path="unused",
            postgres_url="postgresql://unused",
            cassandra_hosts=["unused"],
            storage_mode="local",
            work_phone_prefix="2459",
        )
        row = pd.Series({
            "Nombre": "Brandon Alvarez",
            "Correo": "b@example.com",
            "Ext": "6088",
        })
        mapped = parser.map_row(row)
        self.assertEqual(mapped["work_phone"], "2459-6088")
        self.assertIsNone(mapped["work_phone_ext"])


class GoldenFixtureParityTests(unittest.TestCase):
    """Shared contract with front-cards demo parser (fixtures/golden_*.json)."""

    def setUp(self):
        self.parser = _make_batch_parser()
        self.file_parser = FileParser()
        self.fixtures_dir = os.path.join(os.path.dirname(__file__), "fixtures")
        with open(os.path.join(self.fixtures_dir, "golden_expected.json"), encoding="utf-8") as f:
            import json

            self.expected = json.load(f)

    def test_golden_csv_headers_and_mapped_rows(self):
        csv_path = os.path.join(self.fixtures_dir, "golden_staff_table.csv")
        df = self.file_parser.parse_file(csv_path)
        self.assertEqual(list(df.columns), self.expected["headers"])

        for i, row_spec in enumerate(self.expected["rows"]):
            mapped = self.parser.map_row(df.iloc[i])
            for field, value in row_spec.items():
                self.assertEqual(mapped.get(field), value, msg=f"row {i} field {field}")


if __name__ == "__main__":
    unittest.main()
