#!/usr/bin/env python3
"""
Batch Parsing Service
Entry point for parsing batch files and storing to PostgreSQL + Cassandra hybrid database
"""

import os
import sys
import json
import uuid
import argparse
import logging
import traceback
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

import pandas as pd
import psycopg2
from cassandra.cluster import Cluster
from cassandra import ConsistencyLevel
from cassandra.query import SimpleStatement

# Import parsing logic (will be in same directory)
from data_normalizer import DataNormalizer, FIELD_MAPPING, find_fuzzy_field_match
from file_parser import FileParser
from storage_client import StorageClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class BatchParser:
    """
    Main batch parsing service that coordinates:
    1. File parsing
    2. Data normalization
    3. Hybrid database writes (PostgreSQL + Cassandra)
    """

    def __init__(
        self,
        batch_id: str,
        file_path: str,
        postgres_url: str,
        cassandra_hosts: List[str],
        cassandra_keyspace: str = 'ecards',
        storage_mode: str = 'seaweedfs',
        work_phone_prefix: Optional[str] = None,
        default_country_code: Optional[str] = None
    ):
        self.batch_id = batch_id
        self.file_path = file_path
        self.postgres_url = postgres_url
        self.cassandra_hosts = cassandra_hosts
        self.cassandra_keyspace = cassandra_keyspace
        self.work_phone_prefix = work_phone_prefix
        self.default_country_code = default_country_code

        # Initialize components
        self.normalizer = DataNormalizer()
        self.file_parser = FileParser()
        self.storage_client = StorageClient(storage_mode)

        # Database connections (initialized later)
        self.pg_conn = None
        self.cassandra_session = None

    def connect_databases(self):
        """Establish connections to PostgreSQL and Cassandra"""
        try:
            # Connect to PostgreSQL
            logger.info(f"Connecting to PostgreSQL...")
            self.pg_conn = psycopg2.connect(self.postgres_url)
            logger.info("✅ PostgreSQL connected")

            # Connect to Cassandra
            logger.info(f"Connecting to Cassandra cluster: {self.cassandra_hosts}")
            cluster = Cluster(
                contact_points=self.cassandra_hosts,
                connect_timeout=30
            )
            self.cassandra_session = cluster.connect(self.cassandra_keyspace)
            logger.info(f"✅ Cassandra connected to keyspace: {self.cassandra_keyspace}")

            # Prepare the INSERT statement for contact_records
            insert_cql = """
                INSERT INTO contact_records (
                    batch_record_id, batch_id, created_at, updated_at,
                    full_name, first_name, last_name,
                    work_phone, work_phone_ext, mobile_phone, email,
                    address_street, address_city, address_state, address_postal, address_country,
                    social_instagram, social_twitter, social_facebook,
                    business_name, business_title, business_department, business_url, business_hours,
                    business_address_street, business_address_city, business_address_state,
                    business_address_postal, business_address_country,
                    business_linkedin, business_twitter,
                    personal_url, personal_bio, personal_birthday,
                    extra
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            self.cassandra_prepared_stmt = self.cassandra_session.prepare(insert_cql)
            logger.info("✅ Cassandra prepared statement created")

        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise

    def update_batch_status(self, status: str, error_message: Optional[str] = None,
                           records_count: Optional[int] = None,
                           records_processed: Optional[int] = None):
        """Update batch status in PostgreSQL"""
        try:
            cursor = self.pg_conn.cursor()

            if status == 'PARSING':
                stmt = """
                    UPDATE batches
                    SET status = %s, parsing_started_at = %s, updated_at = %s
                    WHERE id = %s
                """
                values = (status, datetime.now(), datetime.now(), self.batch_id)

                logger.info("=" * 80)
                logger.info("EXECUTING: UPDATE PARSING")
                logger.info(f"Statement placeholders: {stmt.count('%s')}")
                logger.info(f"Values count: {len(values)}")
                logger.info(f"Values: {values}")
                logger.info("=" * 80)

                try:
                    cursor.execute(stmt, values)
                    logger.info("✅ UPDATE PARSING executed successfully")
                except Exception as e:
                    logger.error(f"❌ UPDATE PARSING failed!")
                    logger.error(f"Error type: {type(e).__name__}")
                    logger.error(f"Error message: {str(e)}")
                    logger.error(f"Traceback:\n{traceback.format_exc()}")
                    raise

            elif status == 'PARSED':
                stmt = """
                    UPDATE batches
                    SET status = %s,
                        records_count = %s,
                        records_processed = %s,
                        parsing_completed_at = %s,
                        processed_at = %s,
                        updated_at = %s
                    WHERE id = %s
                """
                values = (status, records_count, records_processed, datetime.now(),
                          datetime.now(), datetime.now(), self.batch_id)

                logger.info("=" * 80)
                logger.info("EXECUTING: UPDATE PARSED")
                logger.info(f"Statement placeholders: {stmt.count('%s')}")
                logger.info(f"Values count: {len(values)}")
                logger.info(f"Values: {values}")
                logger.info("=" * 80)

                try:
                    cursor.execute(stmt, values)
                    logger.info("✅ UPDATE PARSED executed successfully")
                except Exception as e:
                    logger.error(f"❌ UPDATE PARSED failed!")
                    logger.error(f"Error type: {type(e).__name__}")
                    logger.error(f"Error message: {str(e)}")
                    logger.error(f"Traceback:\n{traceback.format_exc()}")
                    raise

            elif status == 'LOADED':
                stmt = """
                    UPDATE batches
                    SET status = %s,
                        records_count = %s,
                        records_processed = %s,
                        updated_at = %s
                    WHERE id = %s
                """
                values = (status, records_count, records_processed, datetime.now(), self.batch_id)

                logger.info("=" * 80)
                logger.info("EXECUTING: UPDATE LOADED")
                logger.info(f"Statement placeholders: {stmt.count('%s')}")
                logger.info(f"Values count: {len(values)}")
                logger.info(f"Values: {values}")
                logger.info("=" * 80)

                try:
                    cursor.execute(stmt, values)
                    logger.info("✅ UPDATE LOADED executed successfully")
                except Exception as e:
                    logger.error(f"❌ UPDATE LOADED failed!")
                    logger.error(f"Error type: {type(e).__name__}")
                    logger.error(f"Error message: {str(e)}")
                    logger.error(f"Traceback:\n{traceback.format_exc()}")
                    raise

            elif status == 'ERROR':
                stmt = """
                    UPDATE batches
                    SET status = %s, error_message = %s, updated_at = %s
                    WHERE id = %s
                """
                values = (status, error_message, datetime.now(), self.batch_id)

                logger.info("=" * 80)
                logger.info("EXECUTING: UPDATE ERROR")
                logger.info(f"Statement placeholders: {stmt.count('%s')}")
                logger.info(f"Values count: {len(values)}")
                logger.info(f"Values: {values}")
                logger.info("=" * 80)

                try:
                    cursor.execute(stmt, values)
                    logger.info("✅ UPDATE ERROR executed successfully")
                except Exception as e:
                    logger.error(f"❌ UPDATE ERROR failed!")
                    logger.error(f"Error type: {type(e).__name__}")
                    logger.error(f"Error message: {str(e)}")
                    logger.error(f"Traceback:\n{traceback.format_exc()}")
                    raise

            self.pg_conn.commit()
            logger.info(f"✅ Batch status updated to: {status}")

        except Exception as e:
            logger.error(f"❌ Failed to update batch status: {e}")
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            self.pg_conn.rollback()
            raise

    def map_row(self, row: pd.Series) -> Dict[str, Any]:
        """
        Map a row from parsed file to vCard fields
        Based on FIELD_MAPPING from __script_v9.py
        """
        mapped = {}

        # Normalize row keys
        row_keys = {str(k).lower().strip(): k for k in row.index}
        matched_keys = set()

        def _assign(target_field: str, val) -> bool:
            """Clean + format a raw cell value and store it under target_field.
            Returns False (and leaves target_field unset) for blank/zero cells so the
            caller's own not-found handling (or a later fuzzy match) still applies."""
            if pd.isna(val):
                return False
            val_str = str(val).strip()
            # Remove trailing .0 from Excel float conversion
            if val_str.endswith('.0'):
                val_str = val_str[:-2]
            if val_str == "" or val_str == "0":
                return False
            # Don't format name fields yet - parse_name needs original casing
            if target_field in ["first_name", "last_name", "full_name"]:
                mapped[target_field] = val_str
            else:
                mapped[target_field] = self.normalizer.format_field(target_field, val_str)
            return True

        # Pass 1: map fields based on FIELD_MAPPING's exact aliases
        for target_field, aliases in FIELD_MAPPING.items():
            found = False
            for alias in aliases:
                alias_lower = alias.lower()
                if alias_lower in row_keys:
                    if _assign(target_field, row[row_keys[alias_lower]]):
                        matched_keys.add(alias_lower)
                        found = True
                        break
                    matched_keys.add(alias_lower)
            if not found:
                mapped[target_field] = None

        # Pass 2: fuzzy fallback for headers that didn't exactly match any alias
        # (label mismatches like "Teléfono Oficina 2", "Cel./WhatsApp"). Never
        # overwrites a field a real alias already claimed.
        for header_key, original_key in row_keys.items():
            if header_key in matched_keys:
                continue
            fuzzy_field = find_fuzzy_field_match(header_key)
            if fuzzy_field and not mapped.get(fuzzy_field):
                _assign(fuzzy_field, row[original_key])

        # Special handling: Name splitting
        if mapped.get("first_name") and not mapped.get("last_name"):
            full_name = mapped["first_name"]
            if " " in full_name:
                parsed_name = self.normalizer.parse_name(full_name)
                mapped["first_name"] = parsed_name["first_name"]
                mapped["last_name"] = parsed_name["last_name"]
                mapped["full_name"] = parsed_name["full_name"]

        # Some sheets have "Teléfono"/"Ext" values swapped even though both headers
        # matched correctly (a full number under "Ext", a short extension under
        # "Teléfono") — reclassify by value shape before normalizing/formatting phones.
        self.normalizer.reconcile_phone_and_extension(mapped)

        # Normalize phones with project-specific configuration
        if mapped.get("mobile_phone"):
            mapped["mobile_phone"] = self.normalizer.normalize_phone(
                mapped["mobile_phone"],
                phone_type="mobile",
                default_country_code=self.default_country_code
            )
        if mapped.get("work_phone"):
            mapped["work_phone"] = self.normalizer.normalize_phone(
                mapped["work_phone"],
                phone_type="work",
                work_phone_prefix=self.work_phone_prefix,
                default_country_code=self.default_country_code
            )

        return mapped

    def insert_record(self, record: Dict[str, Any]) -> str:
        """
        Insert record into hybrid database:
        1. Insert into PostgreSQL batch_records (5 searchable fields)
        2. Insert into Cassandra contact_records (all fields)

        Returns: batch_record_id
        """
        try:
            # Generate UUID for this record
            batch_record_id = str(uuid.uuid4())
            now = datetime.now()

            # 1. Insert into PostgreSQL (5 searchable fields)
            cursor = self.pg_conn.cursor()
            pg_stmt = """
                INSERT INTO batch_records
                (id, batch_id, full_name, work_phone, mobile_phone, email, business_name, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            pg_values = (
                batch_record_id,
                self.batch_id,
                record.get('full_name'),
                record.get('work_phone'),
                record.get('mobile_phone'),
                record.get('email'),
                record.get('business_name'),
                now,
                now
            )

            logger.info("=" * 80)
            logger.info("EXECUTING: PostgreSQL INSERT INTO batch_records")
            logger.info(f"Statement placeholders: {pg_stmt.count('%s')}")
            logger.info(f"Values count: {len(pg_values)}")
            logger.info(f"Values: {pg_values}")
            logger.info("=" * 80)

            try:
                cursor.execute(pg_stmt, pg_values)
                logger.info("✅ PostgreSQL INSERT executed successfully")
            except Exception as e:
                logger.error(f"❌ PostgreSQL INSERT failed!")
                logger.error(f"Error type: {type(e).__name__}")
                logger.error(f"Error message: {str(e)}")
                logger.error(f"Traceback:\n{traceback.format_exc()}")
                raise

            # 2. Insert into Cassandra (all vCard fields) using prepared statement
            cassandra_values = (
                uuid.UUID(batch_record_id),
                uuid.UUID(self.batch_id),
                now,
                now,
                record.get('full_name'),
                record.get('first_name'),
                record.get('last_name'),
                record.get('work_phone'),
                record.get('work_phone_ext'),
                record.get('mobile_phone'),
                record.get('email'),
                record.get('address_street'),
                record.get('address_city'),
                record.get('address_state'),
                record.get('address_postal'),
                record.get('address_country'),
                record.get('social_instagram'),
                record.get('social_twitter'),
                record.get('social_facebook'),
                record.get('business_name'),
                record.get('business_title'),
                record.get('business_department'),
                record.get('business_url'),
                record.get('business_hours'),
                record.get('business_address_street'),
                record.get('business_address_city'),
                record.get('business_address_state'),
                record.get('business_address_postal'),
                record.get('business_address_country'),
                record.get('business_linkedin'),
                record.get('business_twitter'),
                record.get('personal_url'),
                record.get('personal_bio'),
                record.get('personal_birthday'),
                {}  # empty map for extra field
            )

            logger.info("=" * 80)
            logger.info("EXECUTING: Cassandra INSERT INTO contact_records (using prepared statement)")
            logger.info(f"Values count: {len(cassandra_values)}")
            logger.info(f"Values (first 10): {cassandra_values[:10]}")
            logger.info(f"Record data: {record}")
            logger.info("=" * 80)

            try:
                self.cassandra_session.execute(self.cassandra_prepared_stmt, cassandra_values)
                logger.info("✅ Cassandra INSERT executed successfully")
            except Exception as e:
                logger.error(f"❌ Cassandra INSERT failed!")
                logger.error(f"Error type: {type(e).__name__}")
                logger.error(f"Error message: {str(e)}")
                logger.error(f"Full values: {cassandra_values}")
                logger.error(f"Traceback:\n{traceback.format_exc()}")
                raise

            return batch_record_id

        except Exception as e:
            logger.error(f"❌ Failed to insert record: {e}")
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            raise

    def parse_and_store(self):
        """Main parsing and storage workflow"""
        local_file_path = None
        try:
            # Update status to PARSING
            self.update_batch_status('PARSING')

            # Allow UI to show PARSING status for at least 1 second
            time.sleep(1)

            # Download file from storage
            logger.info(f"📥 Downloading file from storage: {self.file_path}")
            local_file_path = self.storage_client.download(self.file_path)
            logger.info(f"✅ Downloaded to: {local_file_path}")

            # Parse file
            logger.info(f"📄 Parsing file: {local_file_path}")
            df = self.file_parser.parse_file(local_file_path)

            if df.empty:
                raise ValueError("No data extracted from file")

            logger.info(f"📊 Found {len(df)} rows to process")

            # Process each row
            records_processed = 0
            for idx, row in df.iterrows():
                try:
                    # Map row to vCard fields
                    mapped_record = self.map_row(row)

                    # Insert into both databases
                    batch_record_id = self.insert_record(mapped_record)

                    records_processed += 1

                    if records_processed % 100 == 0:
                        logger.info(f"⏳ Processed {records_processed}/{len(df)} records...")
                        self.pg_conn.commit()  # Commit every 100 records

                except Exception as e:
                    logger.error(f"❌ Failed to process row {idx}: {e}")
                    # Don't continue - let the error propagate so we know about failures
                    # This prevents silent data loss where PostgreSQL succeeds but Cassandra fails
                    raise

            # Final commit
            self.pg_conn.commit()

            # Update batch status to PARSED
            self.update_batch_status(
                'PARSED',
                records_count=len(df),
                records_processed=records_processed
            )

            logger.info(f"✅ Successfully processed {records_processed}/{len(df)} records")

            # Allow UI to show PARSED status for at least 1 second
            time.sleep(1)

            # Update batch status to LOADED (100% complete, ready for use)
            self.update_batch_status(
                'LOADED',
                records_count=len(df),
                records_processed=records_processed
            )

            logger.info(f"🎉 Batch fully loaded and ready for use")
            return {
                'success': True,
                'records_total': len(df),
                'records_processed': records_processed
            }

        except Exception as e:
            logger.error(f"❌ Parsing failed: {e}")
            self.update_batch_status('ERROR', error_message=str(e))
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            # Cleanup temp file if it was downloaded
            if local_file_path:
                logger.info(f"🧹 Cleaning up temp file: {local_file_path}")
                self.storage_client.cleanup(local_file_path)

    def close_connections(self):
        """Close all database connections"""
        if self.pg_conn:
            self.pg_conn.close()
            logger.info("🔌 PostgreSQL connection closed")
        if self.cassandra_session:
            self.cassandra_session.cluster.shutdown()
            logger.info("🔌 Cassandra connection closed")

def main():
    parser = argparse.ArgumentParser(description='Parse batch file and store to hybrid database')
    parser.add_argument('--batch-id', required=True, help='Batch UUID')
    parser.add_argument('--file-path', required=True, help='Storage path to file (e.g., batches/email/project/file.csv)')
    parser.add_argument('--postgres-url', required=True, help='PostgreSQL connection URL')
    parser.add_argument('--cassandra-hosts', required=True, help='Cassandra hosts (comma-separated)')
    parser.add_argument('--cassandra-keyspace', default='ecards', help='Cassandra keyspace')
    parser.add_argument('--storage-mode', default='seaweedfs', choices=['seaweedfs', 'local'], help='Storage mode')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')
    # Phone formatting configuration
    parser.add_argument('--work-phone-prefix', help='Prefix for 4-digit work phone numbers (e.g., "2222")')
    parser.add_argument('--default-country-code', help='Default country code for 8-digit numbers (e.g., "+(506)")')

    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Parse comma-separated Cassandra hosts
    cassandra_hosts = [h.strip() for h in args.cassandra_hosts.split(',')]

    # Initialize parser
    batch_parser = BatchParser(
        batch_id=args.batch_id,
        file_path=args.file_path,
        postgres_url=args.postgres_url,
        cassandra_hosts=cassandra_hosts,
        cassandra_keyspace=args.cassandra_keyspace,
        storage_mode=args.storage_mode,
        work_phone_prefix=args.work_phone_prefix,
        default_country_code=args.default_country_code
    )

    try:
        # Connect to databases
        batch_parser.connect_databases()

        # Parse and store
        result = batch_parser.parse_and_store()

        # Output result as JSON for Node.js to read
        print(json.dumps(result))

        # Exit with appropriate code
        sys.exit(0 if result['success'] else 1)

    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

    finally:
        batch_parser.close_connections()

if __name__ == "__main__":
    main()
