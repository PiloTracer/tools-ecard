/**
 * Cassandra Schema Verification
 * Verifies keyspace and critical tables exist on application startup
 *
 * NOTE: Schema creation is handled by db-init service (db/init-cassandra/*.cql)
 * This function only verifies that schemas are ready before the app starts.
 */

import { Client } from 'cassandra-driver';
import { createLogger } from '../utils/logger';

const log = createLogger('CassandraInit');

/**
 * Verify Cassandra schema exists on application startup
 * - Checks if keyspace exists
 * - Verifies critical tables are present
 * - Does NOT create schemas (db-init service handles that)
 * - Logs warnings if schemas are missing
 */
export async function initCassandraSchema(): Promise<void> {
  const contactPoints = (process.env.CASSANDRA_HOSTS || 'cassandra').split(',');
  const localDataCenter = process.env.CASSANDRA_DC || 'dc1';
  const port = parseInt(process.env.CASSANDRA_PORT || '9042');
  const keyspace = process.env.CASSANDRA_KEYSPACE || 'ecards_canonical';

  log.info({ keyspace, contactPoints, localDataCenter, port }, 'Verifying Cassandra schema');

  // Create client without keyspace first (to check if keyspace exists)
  const client = new Client({
    contactPoints,
    localDataCenter,
    protocolOptions: {
      port
    },
    socketOptions: {
      connectTimeout: 30000,
      readTimeout: 30000
    }
  });

  try {
    await client.connect();
    log.info('Connected to Cassandra cluster');

    // Check if keyspace exists
    const keyspaceQuery = `
      SELECT keyspace_name
      FROM system_schema.keyspaces
      WHERE keyspace_name = ?
    `;
    const keyspaceResult = await client.execute(keyspaceQuery, [keyspace]);

    if (keyspaceResult.rows.length === 0) {
      log.error({ keyspace }, 'Keyspace not found - schema should be created by db-init service (db/init-cassandra/*.cql)');
      log.warn('Server will continue, but Cassandra features may not work');
      return;
    }

    log.info({ keyspace }, 'Keyspace verified');

    // Verify critical tables exist (tables actively used by code)
    const criticalTables = [
      'contact_records',      // Used by batchRecordRepository
      'template_events',      // Used by cassandraClient
      'template_metadata',    // Used by cassandraClient
      'resource_metadata',    // Used by cassandraClient
      'mode_transitions',     // Used by cassandraClient
      'sync_queue',          // Used by cassandraClient
      'storage_health',      // Used by cassandraClient
      'batch_records',       // Used by batch upload feature
      'batch_events',        // Used by batch upload feature
      'batch_mappings'       // Used by batch upload feature
    ];

    await client.connect();
    await client.execute(`USE ${keyspace}`);

    const tableQuery = `
      SELECT table_name
      FROM system_schema.tables
      WHERE keyspace_name = ? AND table_name = ?
    `;

    const missingTables: string[] = [];

    for (const tableName of criticalTables) {
      const result = await client.execute(tableQuery, [keyspace, tableName]);

      if (result.rows.length === 0) {
        missingTables.push(tableName);
      }
    }

    if (missingTables.length > 0) {
      log.warn({
        missingTables,
        count: missingTables.length
      }, 'Missing critical tables - should be created by db-init service (db/init-cassandra/*.cql)');
    } else {
      log.info('All critical tables verified');
    }

  } catch (error: any) {
    log.error({ error: error.message }, 'Failed to verify Cassandra schema');
    log.warn('Server will continue without Cassandra - make sure Cassandra is running');
  } finally {
    await client.shutdown();
  }
}
