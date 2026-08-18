/**
 * Cassandra client for the render worker.
 *
 * Reads the FULL contact record (all 28 vCard fields) that the batch parser
 * stores in `contact_records` — PostgreSQL only mirrors the 5 searchable
 * columns, so without this the rendered card silently drops every other
 * field (address, social, business details, personal, ...).
 */

import { Client, types as CassandraTypes } from 'cassandra-driver';

let client: Client | null = null;
let connected = false;

function getClient(): Client {
  if (!client) {
    const contactPoints = (process.env.CASSANDRA_HOSTS || 'cassandra').split(',');
    const localDataCenter = process.env.CASSANDRA_DC || 'dc1';
    const keyspace = process.env.CASSANDRA_KEYSPACE || 'ecards_canonical';
    const port = parseInt(process.env.CASSANDRA_PORT || '9042', 10);

    client = new Client({
      contactPoints,
      localDataCenter,
      keyspace,
      protocolOptions: { port },
      socketOptions: {
        connectTimeout: 10000,
        readTimeout: 12000,
      },
    });
  }
  return client;
}

async function ensureConnected(): Promise<void> {
  if (!connected) {
    await getClient().connect();
    connected = true;
  }
}

/** Full contact record mirroring the Cassandra `contact_records` row (snake_case → camelCase). */
export interface FullContactRecord {
  batchRecordId: string;
  batchId: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  workPhone?: string | null;
  workPhoneExt?: string | null;
  mobilePhone?: string | null;
  email?: string | null;
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
}

/** Row column → camelCase property map (all vCard fields). */
const COLUMN_TO_PROPERTY: Record<string, keyof FullContactRecord> = {
  full_name: 'fullName',
  first_name: 'firstName',
  last_name: 'lastName',
  work_phone: 'workPhone',
  work_phone_ext: 'workPhoneExt',
  mobile_phone: 'mobilePhone',
  email: 'email',
  address_street: 'addressStreet',
  address_city: 'addressCity',
  address_state: 'addressState',
  address_postal: 'addressPostal',
  address_country: 'addressCountry',
  social_instagram: 'socialInstagram',
  social_twitter: 'socialTwitter',
  social_facebook: 'socialFacebook',
  business_name: 'businessName',
  business_title: 'businessTitle',
  business_department: 'businessDepartment',
  business_url: 'businessUrl',
  business_hours: 'businessHours',
  business_address_street: 'businessAddressStreet',
  business_address_city: 'businessAddressCity',
  business_address_state: 'businessAddressState',
  business_address_postal: 'businessAddressPostal',
  business_address_country: 'businessAddressCountry',
  business_linkedin: 'businessLinkedin',
  business_twitter: 'businessTwitter',
  personal_url: 'personalUrl',
  personal_bio: 'personalBio',
  personal_birthday: 'personalBirthday',
};

/**
 * Load the full contact record from Cassandra. Returns null when the row is
 * missing (record deleted, legacy batch, or Cassandra unavailable) so callers
 * can fall back to the PostgreSQL 5-field row.
 */
export async function getFullContactRecord(recordId: string): Promise<FullContactRecord | null> {
  try {
    await ensureConnected();
    const result = await getClient().execute(
      'SELECT * FROM contact_records WHERE batch_record_id = ?',
      [CassandraTypes.Uuid.fromString(recordId)],
      { prepare: true }
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    const record: FullContactRecord = {
      batchRecordId: recordId,
      batchId: row.batch_id ? String(row.batch_id) : '',
    };

    type NullableFieldKeys = Exclude<keyof FullContactRecord, 'batchRecordId' | 'batchId'>;
    const recordFields = record as Record<NullableFieldKeys, string | null | undefined>;
    for (const [column, property] of Object.entries(COLUMN_TO_PROPERTY)) {
      const value = row[column];
      recordFields[property as NullableFieldKeys] = value == null ? null : String(value);
    }

    return record;
  } catch (error) {
    // Rendering must not fail because the full-record lookup did — callers
    // fall back to the PostgreSQL searchable fields.
    console.warn(`[Cassandra] Full record lookup failed for ${recordId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Test hook: reset the cached client (lets tests inject their own env). */
export function _resetCassandraClientForTests(): void {
  client = null;
  connected = false;
}
