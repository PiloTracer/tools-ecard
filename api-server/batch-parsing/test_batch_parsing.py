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
import shutil
import tempfile
import unittest

import pandas as pd

import generate_import_templates
from data_normalizer import (
    DataNormalizer,
    CANONICAL_FIELD_MAP,
    _canonical_header_key,
    find_fuzzy_field_match,
)
from file_parser import FileParser
from parser import BatchParser, IGNORE_TARGET, inspect_file_columns, load_explicit_mapping


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

    def test_strong_alias_token_wins_over_filler_noise(self):
        # "correo"/"telefono"/"extension" state the column's meaning; filler tokens
        # like "trabajo"/"oficina" only substring-match business-address aliases and
        # must not turn the header into an ambiguous (unmapped) one.
        self.assertEqual(find_fuzzy_field_match("correo trabajo"), "email")
        self.assertEqual(find_fuzzy_field_match("telefono del trabajo"), "work_phone")
        self.assertEqual(find_fuzzy_field_match("extension de trabajo"), "work_phone_ext")
        self.assertEqual(find_fuzzy_field_match("direccion casa"), "address_street")


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


class UnmappedColumnPreservationTests(unittest.TestCase):
    """Columns no alias/canonical/fuzzy pass claims are preserved in `extra`
    (raw header -> value) and reported via BatchParser.unmapped_columns."""

    def setUp(self):
        self.parser = _make_batch_parser()

    def test_unknown_header_value_preserved_in_extra(self):
        row = pd.Series({
            "Nombre": "Ana Gomez",
            "Correo": "ana@example.com",
            "Employee ID": "EMP-0042",
        })
        mapped = self.parser.map_row(row)
        self.assertEqual(mapped["extra"], {"Employee ID": "EMP-0042"})
        self.assertIn("Employee ID", self.parser.unmapped_columns)

    def test_fully_mapped_row_has_empty_extra(self):
        row = pd.Series({"Nombre": "Ana Gomez", "Correo": "ana@example.com"})
        mapped = self.parser.map_row(row)
        self.assertEqual(mapped["extra"], {})
        self.assertEqual(self.parser.unmapped_columns, set())

    def test_fuzzy_matched_header_is_not_unmapped(self):
        row = pd.Series({"Telefono Oficina 2": "22221111"})
        mapped = self.parser.map_row(row)
        self.assertEqual(mapped["work_phone"], "2222-1111")
        self.assertEqual(mapped["extra"], {})

    def test_blank_cells_are_not_preserved(self):
        row = pd.Series({"Nombre": "Ana Gomez", "Employee ID": None})
        mapped = self.parser.map_row(row)
        self.assertEqual(mapped["extra"], {})


class CanonicalFieldListParityTests(unittest.TestCase):
    """Python FIELD_MAPPING keys must match the canonical vCard field snapshot
    (packages/shared-types/src/domain/vcard-fields.snapshot.json). The snapshot is
    duplicated into fixtures/ per repo convention (see golden_expected.json) because
    the dev container only mounts api-server/; when a full repo checkout is visible
    the fixture copy is also checked against the canonical file."""

    @staticmethod
    def _load_snapshot_ids(path: str) -> set:
        import json

        with open(path, encoding="utf-8") as f:
            return {entry["id"] for entry in json.load(f)}

    def test_field_mapping_matches_canonical_snapshot(self):
        import data_normalizer as dn

        here = os.path.dirname(os.path.abspath(__file__))
        fixture = os.path.join(here, "fixtures", "vcard-fields.snapshot.json")
        self.assertTrue(os.path.exists(fixture), f"missing snapshot fixture: {fixture}")
        fixture_ids = self._load_snapshot_ids(fixture)
        self.assertEqual(set(dn.FIELD_MAPPING.keys()), fixture_ids)

        # Full-repo checkouts (host, CI): also guard the duplicated fixture against
        # the canonical snapshot in packages/shared-types.
        canonical = os.path.abspath(os.path.join(
            here, "..", "..", "packages", "shared-types", "src", "domain",
            "vcard-fields.snapshot.json",
        ))
        if os.path.exists(canonical):
            self.assertEqual(fixture_ids, self._load_snapshot_ids(canonical))


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

    def test_key_value_paste_spanish_work_labels(self):
        # Regression: "telefono trabajo"/"extension trabajo" were silently dropped —
        # no exact alias, and the fuzzy matcher saw the "trabajo" token inside five
        # business-address aliases plus "telefono"/"extension" -> ambiguous -> None,
        # so the line never became a column.
        content = (
            "nombre completo\tExample Person\n"
            "nombre\tExample\n"
            "apellido\tPerson\n"
            "telefono trabajo\t+506 2222 0000\n"
            "extension trabajo\t123\n"
            "movil\t+506 8888 0000\n"
            "correo\texample.person@example.com\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(len(df), 1)
        self.assertEqual(df.iloc[0]["telefono trabajo"], "+506 2222 0000")
        self.assertEqual(df.iloc[0]["extension trabajo"], "123")
        self.assertEqual(
            CANONICAL_FIELD_MAP.get(_canonical_header_key("telefono trabajo")),
            "work_phone",
        )
        self.assertEqual(
            CANONICAL_FIELD_MAP.get(_canonical_header_key("extension trabajo")),
            "work_phone_ext",
        )

    def test_key_value_paste_french_colon_space(self):
        # French labels, colon+space separators (no tabs) — KV path must claim the
        # block before the vertical parser (parity with demo parseCsvText guard).
        content = (
            "Nom Complet: Jeanne Dupont\n"
            "Courriel: jeanne.dupont@exemple.fr\n"
            "Téléphone Bureau: +33 1 23 45 67 89\n"
            "Portable: +33 6 12 34 56 78\n"
            "Adresse: 12 Rue de Rivoli\n"
            "Ville: Paris\n"
            "Code Postal: 75001\n"
            "Pays: France\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(len(df), 1)
        row = df.iloc[0]
        self.assertEqual(row["Nom Complet"], "Jeanne Dupont")
        self.assertEqual(row["Téléphone Bureau"], "+33 1 23 45 67 89")
        self.assertEqual(row["Portable"], "+33 6 12 34 56 78")
        self.assertEqual(row["Code Postal"], "75001")
        self.assertEqual(
            CANONICAL_FIELD_MAP.get(_canonical_header_key("Téléphone Bureau")),
            "work_phone",
        )
        self.assertEqual(
            CANONICAL_FIELD_MAP.get(_canonical_header_key("Portable")),
            "mobile_phone",
        )

    def test_key_value_paste_unknown_label_is_kept_as_column(self):
        # Unknown KV labels must survive as (unmapped) columns so the preview
        # endpoint lists them for manual mapping instead of dropping the values.
        content = (
            "nombre\tExample\n"
            "apellido\tPerson\n"
            "correo\texample.person@example.com\n"
            "Employee ID\tEMP-0042\n"
        )
        path = self._write_tmp(content, ".txt")
        df = self.parser.parse_file(path)
        self.assertEqual(len(df), 1)
        self.assertIn("Employee ID", df.columns)
        self.assertEqual(df.iloc[0]["Employee ID"], "EMP-0042")

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


class VcfParsingTests(unittest.TestCase):
    """vCard (.vcf) import through the real .vcf branch of FileParser +
    BatchParser.map_row. fixtures/vcf_samples.json is the shared contract with
    the demo parser (front-cards/features/demo/fixtures/vcf_samples.json);
    expected values are post-pipeline (format_field, phone normalization)."""

    def setUp(self):
        import json

        self.file_parser = FileParser()
        self.parser = _make_batch_parser()
        self._tmp_paths = []
        fixtures = os.path.join(os.path.dirname(__file__), "fixtures", "vcf_samples.json")
        with open(fixtures, encoding="utf-8") as f:
            self.cases = json.load(f)["cases"]

    def tearDown(self):
        for p in self._tmp_paths:
            try:
                os.unlink(p)
            except OSError:
                pass

    def _write_tmp(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".vcf")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        self._tmp_paths.append(path)
        return path

    def test_shared_fixture_cases(self):
        for case in self.cases:
            with self.subTest(case_id=case["id"]):
                path = self._write_tmp(case["vcf"])
                df = self.file_parser.parse_file(path)
                self.assertEqual(
                    len(df),
                    len(case["expected"]),
                    msg=f"case {case['id']}: row count",
                )
                for i, spec in enumerate(case["expected"]):
                    mapped = self.parser.map_row(df.iloc[i])
                    for field, value in spec.get("fields", {}).items():
                        self.assertEqual(
                            mapped.get(field),
                            value,
                            msg=f"case {case['id']} record {i} field {field}",
                        )
                    for field in spec.get("absentFields", []):
                        self.assertIsNone(
                            mapped.get(field),
                            msg=f"case {case['id']} record {i} field {field} should be absent",
                        )
                    unmapped = (mapped.get("extra") or {}).get("vcf_unmapped", "")
                    for needle in spec.get("unmappedContains", []):
                        self.assertIn(
                            needle,
                            unmapped,
                            msg=f"case {case['id']} record {i} vcf_unmapped",
                        )

    def test_unmapped_properties_reach_extra_not_dropped(self):
        # Pass 0 rule applied to vcf: properties without a canonical field land
        # in the record `extra` map (and in unmapped_columns reporting).
        content = (
            "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Doe;Jane;;\r\nFN:Jane Doe\r\n"
            "X-CUSTOM-ID:EMP-0001\r\nEND:VCARD\r\n"
        )
        path = self._write_tmp(content)
        df = self.file_parser.parse_file(path)
        mapped = self.parser.map_row(df.iloc[0])
        self.assertEqual(mapped["full_name"], "Jane Doe")
        self.assertIn("X-CUSTOM-ID: EMP-0001", mapped["extra"].get("vcf_unmapped", ""))
        self.assertIn("vcf_unmapped", self.parser.unmapped_columns)

    def test_empty_and_garbage_vcf_do_not_crash(self):
        for content in ("", "not a vcard at all\n", "BEGIN:VCARD\r\nEND:VCARD\r\n"):
            with self.subTest(content=content):
                path = self._write_tmp(content)
                df = self.file_parser.parse_file(path)
                self.assertTrue(df.empty)


class TransposedMatrixDetectionTests(unittest.TestCase):
    """Orientation detection for .xls/.xlsx: headers down column A (transposed)
    vs the status-quo header row (horizontal)."""

    def setUp(self):
        self.parser = FileParser()

    def test_clear_vertical_is_transposed(self):
        df = pd.DataFrame([
            ["full_name", "Example Person"],
            ["email", "example.person@example.com"],
            ["work_phone", "+506 2222 0000"],
            ["mobile_phone", "+506 8888 0000"],
        ])
        self.assertTrue(self.parser._is_transposed_matrix(df))

    def test_clear_horizontal_is_not_transposed(self):
        df = pd.DataFrame([
            ["full_name", "email", "work_phone", "mobile_phone"],
            ["Example Person", "example.person@example.com", "+506 2222 0000", "+506 8888 0000"],
            ["Another Person", "another@example.com", "+506 2222 0001", "+506 8888 0001"],
        ])
        self.assertFalse(self.parser._is_transposed_matrix(df))

    def test_ambiguous_scores_fall_back_to_horizontal(self):
        # First row AND first column both look like headers (4 hits each) — no
        # clear margin, so the status-quo horizontal orientation must win.
        df = pd.DataFrame([
            ["full_name", "email", "work_phone", "mobile_phone"],
            ["last_name", "a", "b", "c"],
            ["address_city", "d", "e", "f"],
            ["address_country", "g", "h", "i"],
        ])
        self.assertFalse(self.parser._is_transposed_matrix(df))

    def test_vertical_below_min_matches_is_not_transposed(self):
        # Only 2 header hits in column A — below TRANSPOSED_MIN_MATCHES even
        # though it beats the horizontal score.
        df = pd.DataFrame([
            ["full_name", "Example Person"],
            ["email", "example.person@example.com"],
            ["random label", "random value"],
            ["another label", "another value"],
        ])
        self.assertFalse(self.parser._is_transposed_matrix(df))

    def test_single_column_is_never_transposed(self):
        df = pd.DataFrame([["full_name"], ["email"], ["work_phone"], ["mobile_phone"]])
        self.assertFalse(self.parser._is_transposed_matrix(df))


class TransposedXlsxParsingTests(unittest.TestCase):
    """End-to-end: a transposed .xlsx (headers down column A, contacts across
    columns B+) must parse to the same records as its horizontal twin."""

    def setUp(self):
        self.file_parser = FileParser()
        self.parser = _make_batch_parser()
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _write_xlsx(self, matrix, name: str, styled_empty_cells=()) -> str:
        """Write a matrix to a real .xlsx with openpyxl. Cells listed in
        styled_empty_cells ((row, col) 0-based) are left empty but carry a
        style — openpyxl serializes them as self-closing `<c r=".." s="N"/>`,
        the 2026-07-16 regression shape from real-world exports."""
        from openpyxl import Workbook
        from openpyxl.styles import Font

        wb = Workbook()
        ws = wb.active
        for r, row in enumerate(matrix, start=1):
            for c, value in enumerate(row, start=1):
                cell = ws.cell(row=r, column=c)
                if (r - 1, c - 1) in styled_empty_cells:
                    cell.font = Font(bold=True)
                else:
                    cell.value = value
        path = os.path.join(self.tmpdir, name)
        wb.save(path)
        return path

    HEADERS = ["full_name", "email", "work_phone", "work_phone_ext"]
    CONTACTS = [
        ["Example Person", "example.person@example.com", "+506 2222 0000", "123"],
        ["Another Person", "another@example.com", "+506 2222 0001", ""],
    ]

    def test_transposed_xlsx_matches_horizontal_twin(self):
        horizontal = [self.HEADERS, *self.CONTACTS]
        # Transposed: headers down column A, one contact per column B/C. The
        # blank ext of contact 2 is a styled-but-empty (self-closing) cell.
        transposed = [
            [self.HEADERS[i], self.CONTACTS[0][i], self.CONTACTS[1][i]]
            for i in range(len(self.HEADERS))
        ]
        h_path = self._write_xlsx(horizontal, "horizontal.xlsx")
        v_path = self._write_xlsx(transposed, "vertical.xlsx", styled_empty_cells={(3, 2)})

        df_h = self.file_parser.parse_file(h_path)
        df_v = self.file_parser.parse_file(v_path)

        self.assertEqual(list(df_v.columns), self.HEADERS)
        self.assertEqual(len(df_v), len(self.CONTACTS))
        for i in range(len(self.CONTACTS)):
            self.assertEqual(
                self.parser.map_row(df_v.iloc[i]),
                self.parser.map_row(df_h.iloc[i]),
                msg=f"contact {i} differs between transposed and horizontal parse",
            )

    def test_transposed_golden_fixture_matches_python_golden(self):
        """Transpose the shared golden CSV into a vertical .xlsx; it must map to
        the same records as the horizontal golden (fixtures/golden_expected.json)."""
        import csv
        import json

        fixtures_dir = os.path.join(os.path.dirname(__file__), "fixtures")
        with open(os.path.join(fixtures_dir, "golden_staff_table.csv"), encoding="utf-8") as f:
            rows = [row for row in csv.reader(f)]
        with open(os.path.join(fixtures_dir, "golden_expected.json"), encoding="utf-8") as f:
            expected = json.load(f)

        transposed = [[rows[0][i], rows[1][i], rows[2][i]] for i in range(len(rows[0]))]
        # Ada's blank Ext becomes a styled-but-empty (self-closing) cell.
        styled = {(i, 2) for i in range(len(rows[0])) if rows[2][i] == ""}
        path = self._write_xlsx(transposed, "golden_transposed.xlsx", styled_empty_cells=styled)

        df = self.file_parser.parse_file(path)
        self.assertEqual(list(df.columns), expected["headers"])
        for i, row_spec in enumerate(expected["rows"]):
            mapped = self.parser.map_row(df.iloc[i])
            for field, value in row_spec.items():
                self.assertEqual(mapped.get(field), value, msg=f"row {i} field {field}")

    def test_transposed_xlsx_with_explicit_mapping(self):
        """Transposed + explicit mapping combined: the user-mapped column is
        honored after the flip, alias columns still auto-map, and nothing is
        silently dropped."""
        # Four recognizable headers keep the orientation score unambiguous (the
        # weird "Legacy Code" column alone would not trip transposed detection).
        headers = ["full_name", "email", "work_phone", "mobile_phone", "Legacy Code"]
        contacts = [
            ["Example Person", "example.person@example.com", "+506 2222 0000", "+506 8888 0000", "L-1"],
            ["Another Person", "another@example.com", "+506 2222 0001", "+506 8888 0001", "L-2"],
        ]
        transposed = [
            [headers[i], contacts[0][i], contacts[1][i]] for i in range(len(headers))
        ]
        path = self._write_xlsx(transposed, "vertical_mapped.xlsx")
        df = self.file_parser.parse_file(path)
        self.assertEqual(list(df.columns), headers)

        parser = _make_batch_parser()
        parser.explicit_mapping = {_canonical_header_key("Legacy Code"): "business_name"}
        mapped = parser.map_row(df.iloc[0])
        # Explicit claim wins on the transposed header; the rest falls through to auto.
        self.assertEqual(mapped["business_name"], "L-1")
        self.assertEqual(mapped["full_name"], "Example Person")
        self.assertEqual(mapped["email"], "example.person@example.com")
        self.assertEqual(mapped["extra"], {})
        self.assertEqual(parser.unmapped_columns, set())

    def test_inspect_reports_transposed_headers(self):
        """--inspect on a transposed file must analyze the flipped matrix: the
        reported columns are the column-A headers, with samples taken across
        the contact columns. Powers preview on vertical uploads."""
        headers = ["full_name", "email", "work_phone", "mobile_phone", "Qzzx Wvln"]
        contacts = [
            ["Example Person", "example.person@example.com", "+506 2222 0000", "+506 8888 0000", "L-1"],
            ["Another Person", "another@example.com", "+506 2222 0001", "+506 8888 0001", "L-2"],
        ]
        transposed = [
            [headers[i], contacts[0][i], contacts[1][i]] for i in range(len(headers))
        ]
        path = self._write_xlsx(transposed, "vertical_inspect.xlsx")
        result = inspect_file_columns(path)
        self.assertTrue(result["success"])
        self.assertEqual(result["rows_total"], 2)
        by_header = {c["source_column"]: c for c in result["columns"]}
        self.assertEqual(set(by_header), set(headers))
        self.assertEqual(by_header["full_name"]["auto_field"], "full_name")
        self.assertEqual(by_header["Qzzx Wvln"]["auto_field"], None)
        self.assertEqual(by_header["Qzzx Wvln"]["confidence"], "none")
        self.assertEqual(by_header["Qzzx Wvln"]["sample_values"], ["L-1", "L-2"])


class ImportTemplateTests(unittest.TestCase):
    """Generated import-template workbooks (plan tasks 6+7): headers must match
    the canonical snapshot exactly, and the vertical template must parse through
    the Normal pipeline to the same record as its horizontal twin."""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        generate_import_templates.generate(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_generated_templates_match_snapshot(self):
        # verify() asserts headers (order + values) and the example contact
        # against the snapshot/EXAMPLE_VALUES; raises AssertionError on drift.
        generate_import_templates.verify(self.tmpdir)

    def test_committed_templates_match_snapshot_when_repo_visible(self):
        # The committed static assets live in front-cards/, which the api-server
        # dev container does not mount — check them only on full-repo checkouts.
        committed = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "..", "front-cards", "public", "templates"
        ))
        if not os.path.isdir(committed):
            self.skipTest("front-cards/ not mounted (api-server container)")
        generate_import_templates.verify(committed)

    def test_vertical_template_parses_like_horizontal_twin(self):
        file_parser = FileParser()
        parser = _make_batch_parser()
        df_h = file_parser.parse_file(
            os.path.join(self.tmpdir, generate_import_templates.HORIZONTAL_FILENAME)
        )
        df_v = file_parser.parse_file(
            os.path.join(self.tmpdir, generate_import_templates.VERTICAL_FILENAME)
        )
        self.assertEqual(list(df_v.columns), list(df_h.columns))
        self.assertEqual(len(df_v), len(df_h))
        for i in range(len(df_h)):
            self.assertEqual(parser.map_row(df_v.iloc[i]), parser.map_row(df_h.iloc[i]))


class ExplicitMappingTests(unittest.TestCase):
    """Explicit user field mapping (Pass 3): consulted before the
    alias/canonical/fuzzy passes; 'ignore' columns go to `extra` verbatim;
    unknown targets are a hard error; uncovered columns fall through to auto."""

    def _parser_with_mapping(self, mapping: dict) -> BatchParser:
        p = _make_batch_parser()
        p.explicit_mapping = mapping
        return p

    def test_explicit_mapping_beats_alias(self):
        # "Correo" is an exact email alias; the explicit mapping must win.
        # (business_name preserves value casing, so the assertion is exact.)
        parser = self._parser_with_mapping({_canonical_header_key("Correo"): "business_name"})
        row = pd.Series({"Nombre": "Ana Gomez", "Correo": "ana@example.com"})
        mapped = parser.map_row(row)
        self.assertEqual(mapped["business_name"], "ana@example.com")
        self.assertIsNone(mapped["email"])
        self.assertEqual(mapped["extra"], {})

    def test_ignore_target_goes_to_extra_verbatim(self):
        parser = self._parser_with_mapping({_canonical_header_key("Employee ID"): IGNORE_TARGET})
        row = pd.Series({"Nombre": "Ana Gomez", "Employee ID": "EMP-0042"})
        mapped = parser.map_row(row)
        self.assertEqual(mapped["extra"], {"Employee ID": "EMP-0042"})
        # A deliberate ignore is not a mapping gap.
        self.assertEqual(parser.unmapped_columns, set())

    def test_partial_mapping_falls_through_to_auto_passes(self):
        parser = self._parser_with_mapping({_canonical_header_key("Correo"): "email"})
        row = pd.Series({
            "Nombre": "Ana Gomez",
            "Correo": "ana@example.com",
            "Telefono Oficina 2": "22221111",  # fuzzy fallback, not covered by mapping
        })
        mapped = parser.map_row(row)
        self.assertEqual(mapped["email"], "ana@example.com")
        self.assertEqual(mapped["work_phone"], "2222-1111")
        self.assertEqual(mapped["extra"], {})

    def test_unmapped_explicit_column_still_goes_to_extra(self):
        # Columns neither explicitly mapped nor auto-matched keep Pass 0 behavior.
        # ("Qzzx Wvln" matches no alias/canonical/fuzzy token by construction.)
        parser = self._parser_with_mapping({_canonical_header_key("Correo"): "email"})
        row = pd.Series({"Correo": "ana@example.com", "Qzzx Wvln": "L-9"})
        mapped = parser.map_row(row)
        self.assertEqual(mapped["extra"], {"Qzzx Wvln": "L-9"})
        self.assertIn("Qzzx Wvln", parser.unmapped_columns)


class LoadExplicitMappingTests(unittest.TestCase):
    def setUp(self):
        self._tmp_paths = []

    def tearDown(self):
        for p in self._tmp_paths:
            try:
                os.unlink(p)
            except OSError:
                pass

    def _write_mapping(self, payload) -> str:
        import json
        fd, path = tempfile.mkstemp(suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f)
        self._tmp_paths.append(path)
        return path

    def test_loads_and_normalizes_source_columns(self):
        path = self._write_mapping({"mappings": [
            {"source_column": "E Mail", "target_field": "email"},
            {"source_column": "Legacy Code", "target_field": "ignore"},
        ]})
        mapping = load_explicit_mapping(path)
        self.assertEqual(mapping, {"e_mail": "email", "legacy_code": "ignore"})

    def test_unknown_target_field_is_a_hard_error(self):
        path = self._write_mapping({"mappings": [
            {"source_column": "Correo", "target_field": "emial"},  # typo
        ]})
        with self.assertRaises(ValueError) as ctx:
            load_explicit_mapping(path)
        # The error must list valid ids so the caller can fail fast, never guess.
        self.assertIn("email", str(ctx.exception))
        self.assertIn("ignore", str(ctx.exception))

    def test_missing_mappings_list_is_a_hard_error(self):
        path = self._write_mapping({"nope": []})
        with self.assertRaises(ValueError):
            load_explicit_mapping(path)


class InspectFileColumnsTests(unittest.TestCase):
    def setUp(self):
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

    def test_reports_per_column_confidence_and_samples(self):
        content = (
            "Nombre,Correo,Employee ID\n"
            "Ana Gomez,ana@example.com,EMP-0042\n"
            "Luis Perez,luis@example.com,EMP-0043\n"
        )
        path = self._write_tmp(content, ".csv")
        result = inspect_file_columns(path)
        self.assertTrue(result["success"])
        self.assertEqual(result["rows_total"], 2)
        by_header = {c["source_column"]: c for c in result["columns"]}
        self.assertEqual(by_header["Nombre"]["auto_field"], "first_name")
        self.assertEqual(by_header["Nombre"]["confidence"], "alias")
        self.assertEqual(by_header["Correo"]["auto_field"], "email")
        self.assertEqual(by_header["Employee ID"]["auto_field"], None)
        self.assertEqual(by_header["Employee ID"]["confidence"], "none")
        self.assertEqual(by_header["Employee ID"]["sample_values"], ["EMP-0042", "EMP-0043"])
        self.assertIn("email", result["target_fields"])

    def test_canonical_and_fuzzy_confidence_levels(self):
        content = (
            "Business Address Street,Telefono Oficina 2\n"
            "123 Main St,22221111\n"
        )
        path = self._write_tmp(content, ".csv")
        result = inspect_file_columns(path)
        by_header = {c["source_column"]: c for c in result["columns"]}
        self.assertEqual(by_header["Business Address Street"]["confidence"], "canonical")
        self.assertEqual(
            by_header["Business Address Street"]["auto_field"], "business_address_street"
        )
        self.assertEqual(by_header["Telefono Oficina 2"]["confidence"], "fuzzy")
        self.assertEqual(by_header["Telefono Oficina 2"]["auto_field"], "work_phone")




class FieldAliasTableTests(unittest.TestCase):
    """Per-language alias table (fixtures/field-aliases.snapshot.json, duplicated from
    packages/shared-types/src/domain/field-aliases.json) drives FIELD_MAPPING.
    Guards: no alias loss vs the table, bucket completeness (en/es/fr), no internal
    conflicts, and EN/ES/FR header variations resolving to the right canonical field."""

    FIXTURE = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "fixtures", "field-aliases.snapshot.json"
    )
    BRAND_FIELDS = {
        "social_instagram", "social_twitter", "social_facebook",
        "business_linkedin", "business_twitter",
    }

    @classmethod
    def setUpClass(cls):
        import json

        with open(cls.FIXTURE, encoding="utf-8") as f:
            cls.table = json.load(f)["fields"]

    def test_field_mapping_matches_alias_fixture(self):
        import data_normalizer as dn

        self.assertEqual(set(dn.FIELD_MAPPING.keys()), set(self.table.keys()))
        for field, buckets in self.table.items():
            flat = [a for b in buckets.values() for a in b]
            for alias in [field, *flat]:
                self.assertIn(alias, dn.FIELD_MAPPING[field])

    def test_alias_fixture_fields_match_canonical_snapshot(self):
        import json

        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "fixtures", "vcard-fields.snapshot.json"), encoding="utf-8") as f:
            snapshot_ids = {e["id"] for e in json.load(f)}
        self.assertEqual(set(self.table.keys()), snapshot_ids)

    def test_language_buckets_complete(self):
        for field, buckets in self.table.items():
            self.assertGreater(len(buckets.get("en", [])), 0, f"{field}: empty en bucket")
            if field in self.BRAND_FIELDS:
                continue  # brand names need no translation
            self.assertGreater(len(buckets.get("es", [])), 0, f"{field}: empty es bucket")
            self.assertGreater(len(buckets.get("fr", [])), 0, f"{field}: empty fr bucket")

    def test_no_internal_alias_conflicts(self):
        import data_normalizer as dn

        seen = {}
        for field, buckets in self.table.items():
            for alias in [field, *[a for b in buckets.values() for a in b]]:
                key = dn._canonical_header_key(alias)
                if key in seen:
                    self.assertEqual(seen[key], field, f"alias {alias!r} maps to both {seen[key]} and {field}")
                seen[key] = field

    VARIATIONS = {
        "full_name": ["Full Name", "Nombre Completo", "Nom Complet", "nom complet"],
        "first_name": ["First Name", "Nombre", "Prénom", "PRENOM"],
        "last_name": ["Last Name", "Apellidos", "Nom de famille", "Nom"],
        "work_phone": ["work phone", "Telefono Trabajo", "TELÉFONO OFICINA", "Téléphone Bureau", "tel"],
        "work_phone_ext": ["Ext", "Extensión", "Extension Trabajo", "Poste Téléphonique"],
        "mobile_phone": ["mobile", "Celular", "WhatsApp", "Portable", "Téléphone Portable"],
        "email": ["Email", "Correo", "Correo Electrónico", "Courriel", "e-mail"],
        "address_street": ["Street Address", "Dirección", "Adresse", "Rue"],
        "address_city": ["City", "Ciudad", "Ville"],
        "address_state": ["State", "Provincia", "Région", "État"],
        "address_postal": ["Zip Code", "Código Postal", "Code Postal"],
        "address_country": ["Country", "País", "Pays"],
        "social_instagram": ["Instagram"],
        "social_twitter": ["Twitter", "X"],
        "social_facebook": ["Facebook"],
        "business_name": ["Company", "Empresa", "Entreprise", "Société"],
        "business_title": ["Job Title", "Puesto", "Cargo", "Poste", "Fonction"],
        "business_department": ["Department", "Área", "Service", "Département"],
        "business_url": ["Website", "Sitio Web", "Site Web"],
        "business_hours": ["Business Hours", "Horario", "Horaires"],
        "business_address_street": ["Business Address", "Dirección Trabajo", "Adresse Professionnelle"],
        "business_address_city": ["Business City", "Ciudad Trabajo", "Ville Travail"],
        "business_address_state": ["Business State", "Estado Trabajo", "Province Travail"],
        "business_address_postal": ["Business Zip", "Postal Trabajo", "Code Postal Travail"],
        "business_address_country": ["Business Country", "País Trabajo", "Pays Travail"],
        "business_linkedin": ["LinkedIn"],
        "business_twitter": ["Company Twitter"],
        "personal_url": ["Personal Website", "Sitio Personal", "Site Personnel"],
        "personal_bio": ["Notes", "Notas", "Biographie"],
        "personal_birthday": ["Birthday", "Cumpleaños", "Date de Naissance", "Anniversaire"],
    }

    def test_en_es_fr_variations_resolve(self):
        import data_normalizer as dn

        for field, headers in self.VARIATIONS.items():
            for header in headers:
                key = dn._canonical_header_key(header)
                resolved = dn.CANONICAL_FIELD_MAP.get(key) or dn.find_fuzzy_field_match(header)
                self.assertEqual(resolved, field, f"{header!r} resolved to {resolved}, expected {field}")

    def test_french_fuzzy_variations_with_filler_words(self):
        import data_normalizer as dn

        self.assertEqual(dn.find_fuzzy_field_match("Téléphone de Bureau 2"), "work_phone")
        self.assertEqual(dn.find_fuzzy_field_match("Numéro de Portable 2"), "mobile_phone")
        self.assertEqual(dn.find_fuzzy_field_match("Courriel Professionnel"), "email")


if __name__ == "__main__":
    unittest.main()
