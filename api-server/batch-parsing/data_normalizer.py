"""
Data Normalizer Module
Handles field formatting, phone normalization, and name parsing
Extracted from __script_v9.py
"""

import re
import unicodedata
from typing import Dict, Any

import pandas as pd
import phonenumbers
from nameparser import HumanName

# Field mapping: maps various column name aliases to standardized field names
# Keys MUST match the 'id' field in vcardFields.ts
FIELD_MAPPING = {
    # Core
    "first_name": ["first_name", "firstName", "first name", "firstname", "fname", "given name", "nombre"],
    "last_name": ["last_name", "lastName", "last name", "lastname", "lname", "surname", "family name", "apellidos"],
    "full_name": ["full_name", "fullName", "full name", "nombre completo"],
    "email": ["email", "e-mail", "mail", "email address", "correo", "correo electrónico", "correo electronico"],
    "work_phone": ["work_phone", "workPhone", "work phone", "office phone", "business phone", "tel", "phone", "telefono", "teléfono", "telefono ofi", "teléfono ofi"],
    "work_phone_ext": ["work_phone_ext", "ext", "extension", "extensión"],
    "mobile_phone": ["mobile_phone", "mobilePhone", "mobile", "cell", "cellular", "mobile phone", "cell phone", "celular", "móvil"],

    # Address (Core)
    "address_street": ["address_street", "address", "street", "street address", "dirección", "direccion", "calle"],
    "address_city": ["address_city", "city", "town", "ciudad"],
    "address_state": ["address_state", "state", "province", "region", "estado", "provincia"],
    "address_postal": ["address_postal", "zip", "postal", "zip code", "postal code", "código postal", "codigo postal"],
    "address_country": ["address_country", "country", "nation", "país", "pais"],

    # Socials
    "social_instagram": ["social_instagram", "instagram", "ig"],
    "social_twitter": ["social_twitter", "twitter", "x"],
    "social_facebook": ["social_facebook", "facebook", "fb"],

    # Business
    "business_name": ["business_name", "organization", "company", "business", "org", "empresa"],
    "business_title": ["business_title", "title", "job title", "position", "role", "puesto", "cargo"],
    "business_department": ["business_department", "department", "dept", "departamento", "area"],
    "business_url": ["business_url", "website", "url", "web", "sitio web"],
    "business_hours": ["business_hours", "hours", "business hours", "horario"],

    # Business Address (Overrides)
    "business_address_street": ["business_address_street", "business address", "business street", "dirección trabajo"],
    "business_address_city": ["business_address_city", "business city", "ciudad trabajo"],
    "business_address_state": ["business_address_state", "business state", "estado trabajo"],
    "business_address_postal": ["business_address_postal", "business zip", "postal trabajo"],
    "business_address_country": ["business_address_country", "business country", "país trabajo"],

    # Professional Profiles
    "business_linkedin": ["business_linkedin", "linkedin", "li"],
    "business_twitter": ["business_twitter", "company twitter"],

    # Personal
    "personal_url": ["personal_url", "personal website", "personal url", "sitio personal"],
    "personal_bio": ["personal_bio", "notes", "comments", "description", "notas", "comentarios", "bio", "biography"],
    "personal_birthday": ["personal_birthday", "birthday", "dob", "cumpleaños", "fecha nacimiento"]
}

class DataNormalizer:
    """
    Normalizes and formats data fields according to vCard standards
    """

    def __init__(self):
        # Common Spanish given names (from Costa Rica data)
        self.spanish_given_names = {
            'jose', 'maria', 'juan', 'carlos', 'luis', 'ana', 'pedro', 'francisco',
            'miguel', 'antonio', 'manuel', 'jesus', 'raul', 'eduardo', 'alberto',
            'jorge', 'roberto', 'ricardo', 'fernando', 'rafael', 'andres', 'diego',
            'daniel', 'alejandro', 'javier', 'sergio', 'pablo', 'enrique', 'ramon',
            'sofia', 'isabel', 'carmen', 'rosa', 'laura', 'patricia', 'monica',
            'andrea', 'cristina', 'elena', 'teresa', 'beatriz', 'silvia', 'marta',
            'valeria', 'gabriela', 'carolina', 'paula', 'adriana', 'natalia',
            'alexander', 'david', 'victor', 'william', 'stephanie', 'melissa',
            'jessica', 'michael', 'kevin', 'steven', 'jonathan', 'christopher',
            'oscar', 'gustavo', 'esteban', 'tatiana', 'viviana'
        }

        self.spanish_surname_prefixes = {
            'de', 'del', 'la', 'los', 'las', 'y', 'von', 'van', 'di', 'da', 'dos', 'angeles'
        }

    def smart_title_case(self, text: str) -> str:
        """
        Apply smart title case that keeps articles and prepositions lowercase
        Similar to Chicago Manual of Style or AP Stylebook

        Articles kept lowercase: de, del, la, las, los, y, a, an, the, of, and, or, in, on, at, to, for, with
        Always capitalize first and last word regardless
        """
        # Common Spanish and English articles/prepositions to keep lowercase
        lowercase_words = {
            # Spanish
            'de', 'del', 'la', 'las', 'los', 'y', 'el', 'un', 'una', 'unos', 'unas',
            'en', 'con', 'sin', 'por', 'para', 'desde', 'hasta',
            # English
            'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for',
            'with', 'from', 'by', 'as', 'is', 'was', 'are', 'were'
        }

        words = text.split()
        if not words:
            return text

        result = []
        for i, word in enumerate(words):
            # Always capitalize first and last word
            if i == 0 or i == len(words) - 1:
                result.append(word.capitalize())
            # Keep articles/prepositions lowercase if they're in the middle
            elif word.lower() in lowercase_words:
                result.append(word.lower())
            else:
                result.append(word.capitalize())

        return ' '.join(result)

    def format_field(self, key: str, value: Any) -> str:
        """Format field value according to field-specific rules"""
        if pd.isna(value) or str(value).strip() == "":
            return ""

        text = str(value).strip()

        # Rule 2: For business names don't change the letter casing
        if key == "business_name":
            return text

        # Emails and URLs should be lowercase
        if key in ["email", "business_url", "personal_url", "business_linkedin",
                   "social_instagram", "social_twitter", "social_facebook"]:
            return text.lower()

        # Fields that need smart title case (keep articles lowercase)
        smart_title_fields = [
            "address_street", "address_city", "address_state", "address_country",
            "business_title", "business_department",
            "business_address_street", "business_address_city",
            "business_address_state", "business_address_country"
        ]

        if key in smart_title_fields:
            # Preserve text inside parentheses
            parentheses_content = {}

            def preserve_parens(match):
                placeholder = f"__PAREN_{len(parentheses_content)}__"
                parentheses_content[placeholder] = match.group(0)
                return placeholder

            text_with_placeholders = re.sub(r'\([^)]+\)', preserve_parens, text)

            # Apply smart title case
            formatted = self.smart_title_case(text_with_placeholders)

            # Restore parentheses content with original casing
            for placeholder, original in parentheses_content.items():
                formatted = formatted.replace(placeholder, original)

            return formatted

        # Rule 3: For all other fields, apply regular Title Case
        # BUT preserve text inside parentheses
        parentheses_content = {}

        def preserve_parens(match):
            placeholder = f"__PAREN_{len(parentheses_content)}__"
            parentheses_content[placeholder] = match.group(0)
            return placeholder

        text_with_placeholders = re.sub(r'\([^)]+\)', preserve_parens, text)

        # Apply title case
        formatted = text_with_placeholders.title()

        # Restore parentheses content with original casing
        for placeholder, original in parentheses_content.items():
            formatted = formatted.replace(placeholder.title(), original)

        return formatted

    def normalize_phone(
        self,
        phone_raw: Any,
        phone_type: str = "other",
        work_phone_prefix: str = None,
        default_country_code: str = None
    ) -> str:
        """
        Normalize phone numbers for Costa Rica with project-specific configuration

        Args:
            phone_raw: Raw phone number input
            phone_type: "work", "mobile", or "other"
            work_phone_prefix: Prefix for 4-digit work phones (e.g., "2222")
            default_country_code: Default country code for 8-digit numbers (e.g., "+(506)")

        Rules:
            1. Any number starting with "+" → preserve completely unchanged
            2. For work_phone with exactly 4 digits → apply work_phone_prefix if provided
            3. Numbers with 1-3 digits → treated as extension (returned as-is)
            4. Numbers with exactly 8 digits (after prefix) and no "+" → apply default_country_code
            5. Numbers with != 8 digits → left unchanged (unknown country)
            6. Final format for Costa Rica: "+(506) XXXX-XXXX"
        """
        if pd.isna(phone_raw) or str(phone_raw).strip() == "":
            return ""

        raw_str = str(phone_raw).strip()
        if raw_str.lower() in ["nan", "none", "null"]:
            return ""

        # Rule 1: Preserve E.164 formatted numbers completely unchanged
        if raw_str.startswith("+"):
            return raw_str

        # Extract digits only for logic checks
        digits = "".join(filter(str.isdigit, raw_str))

        # Rule 3: 1-3 digits are extensions, return as-is
        if len(digits) <= 3:
            return digits

        # Rule 2: Apply work phone prefix for exactly 4 digits (work_phone only)
        if phone_type == "work" and len(digits) == 4 and work_phone_prefix:
            # Apply prefix
            digits = work_phone_prefix + digits

        # Rule 5: If not exactly 8 digits, leave unchanged (unknown country)
        if len(digits) != 8:
            return raw_str

        # At this point, we have exactly 8 digits
        # Rule 4: Apply default country code if provided
        if default_country_code:
            # Format: "+(506) XXXX-XXXX"
            formatted = f"{default_country_code} {digits[:4]}-{digits[4:]}"
            return formatted
        else:
            # No country code configured, use simple format: "XXXX-XXXX"
            return f"{digits[:4]}-{digits[4:]}"

    def parse_name(self, full_name: str) -> Dict[str, str]:
        """
        Parse full name into components using Spanish and international heuristics
        """
        if pd.isna(full_name) or str(full_name).strip() == "":
            return {
                "first_name": "",
                "last_name": "",
                "full_name": "",
                "business_title": "",
                "suffix": ""
            }

        raw_name = str(full_name).strip()
        name_parts = [part for part in raw_name.split() if part]

        if len(name_parts) == 0:
            return {
                "first_name": "",
                "last_name": "",
                "full_name": "",
                "business_title": "",
                "suffix": ""
            }

        first_name = ""
        last_name = ""
        title = ""
        suffix = ""

        # TIER 1: Check for Spanish surname-first format
        is_spanish_format = False
        is_all_caps = raw_name.isupper()

        if len(name_parts) >= 2:
            first_word_norm = self._normalize_word(name_parts[0])

            # If FIRST word is a Spanish given name, it's normal order
            if first_word_norm in self.spanish_given_names:
                is_spanish_format = False
            elif len(name_parts) == 4:
                word2_norm = self._normalize_word(name_parts[2])
                word3_norm = self._normalize_word(name_parts[3])
                if word2_norm in self.spanish_given_names and word3_norm in self.spanish_given_names:
                    is_spanish_format = True
            elif is_all_caps and len(name_parts) >= 3:
                is_spanish_format = True

        if is_spanish_format:
            # Spanish format: SURNAME1 SURNAME2 FIRSTNAME1 FIRSTNAME2
            if len(name_parts) == 2:
                last_name = name_parts[0]
                first_name = name_parts[1]
            elif len(name_parts) == 3:
                word2_norm = self._normalize_word(name_parts[2])
                if word2_norm in self.spanish_given_names:
                    last_name = " ".join(name_parts[:2])
                    first_name = name_parts[2]
                else:
                    last_name = " ".join(name_parts[:2])
                    first_name = name_parts[2]
            elif len(name_parts) >= 4:
                # Count trailing given names
                given_name_count = 0
                for i in range(len(name_parts) - 1, -1, -1):
                    word_normalized = self._normalize_word(name_parts[i])
                    if word_normalized in self.spanish_given_names or word_normalized in self.spanish_surname_prefixes:
                        given_name_count += 1
                    else:
                        break

                if given_name_count >= 2:
                    last_name = " ".join(name_parts[:2])
                    first_name = " ".join(name_parts[2:])
                else:
                    last_name = " ".join(name_parts[:2])
                    first_name = " ".join(name_parts[2:])
        else:
            # TIER 2: Normal order (FIRSTNAME LASTNAME)
            if len(name_parts) == 3:
                first_name = name_parts[0]
                last_name = " ".join(name_parts[1:])
            elif len(name_parts) >= 4:
                first_word_norm = self._normalize_word(name_parts[0])
                second_word_norm = self._normalize_word(name_parts[1])
                if first_word_norm in self.spanish_given_names and second_word_norm in self.spanish_given_names:
                    first_name = " ".join(name_parts[:2])
                    last_name = " ".join(name_parts[2:])
                else:
                    first_name = name_parts[0]
                    last_name = " ".join(name_parts[1:])
            else:
                # TIER 3: Use nameparser for English names
                hn = HumanName(raw_name)
                first_name = f"{hn.first} {hn.middle}".strip()
                last_name = hn.last
                title = hn.title
                suffix = hn.suffix

                if not first_name and not last_name:
                    if len(name_parts) >= 2:
                        first_name = name_parts[0]
                        last_name = " ".join(name_parts[1:])
                    else:
                        first_name = raw_name
                        last_name = ""

        # Build proper full_name
        proper_full_name = f"{first_name} {last_name}".strip()

        return {
            "first_name": first_name.title() if first_name else "",
            "last_name": last_name.title() if last_name else "",
            "full_name": proper_full_name.title() if proper_full_name else raw_name.title(),
            "business_title": title.title() if title else "",
            "suffix": suffix
        }

    def _normalize_word(self, word: str) -> str:
        """Normalize word by removing accents for matching"""
        word_lower = word.lower()
        return ''.join(
            c for c in unicodedata.normalize('NFD', word_lower)
            if unicodedata.category(c) != 'Mn'
        )
