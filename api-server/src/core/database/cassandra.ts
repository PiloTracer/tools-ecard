/**
 * Cassandra client
 * For canonical event logging
 */

import { Client } from 'cassandra-driver';
import { appConfig } from '../config';

// MOCK: Cassandra client setup
export const cassandraClient = new Client({
  contactPoints: appConfig.cassandra.contactPoints,
  localDataCenter: appConfig.cassandra.localDataCenter,
  keyspace: appConfig.cassandra.keyspace,
});

export async function connectCassandra(): Promise<void> {
  try {
    await cassandraClient.connect();
    console.log('✅ Connected to Cassandra');
  } catch (error) {
    console.error('❌ Failed to connect to Cassandra:', error);
    // Don't crash the app if Cassandra is unavailable
    // TODO [backend]: Implement retry logic
  }
}

export async function disconnectCassandra(): Promise<void> {
  await cassandraClient.shutdown();
  console.log('Cassandra connection closed');
}
