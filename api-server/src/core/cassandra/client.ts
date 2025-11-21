/**
 * Cassandra Client Wrapper
 * Provides connection management and query utilities for Cassandra database
 */

import { Client, types as CassandraTypes, auth } from 'cassandra-driver';
import { v4 as uuidv4 } from 'uuid';

// Define storage modes enum
export enum StorageMode {
  FULL = 'full',
  FALLBACK = 'fallback',
  LOCAL_ONLY = 'local_only'
}

// Type definitions for Cassandra operations
export interface TemplateEvent {
  userId: string;
  templateId: string;
  eventId: string;
  eventType: string;
  storageMode: StorageMode;
  eventData: string;
  syncStatus?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface TemplateMetadata {
  templateId: string;
  userId: string;
  fullMetadata: string;
  eventHistory?: string;
  auditTrail?: string;
  storageModesUsed?: Set<string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceMetadata {
  hash: string;
  resourceId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageUrl: string;
  storageMode: string;
  referenceCount: number;
  firstSeen: Date;
  lastAccessed: Date;
  metadataJson?: string;
}

export interface ModeTransition {
  userId: string;
  transitionId: string;
  fromMode: string;
  toMode: string;
  trigger: string;
  reason: string;
  transitionTime: Date;
  success: boolean;
  errorDetails?: string;
}

export interface SyncQueueItem {
  userId: string;
  queueId: string;
  itemType: string;
  itemId: string;
  operation: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  dataJson: string;
  createdAt: Date;
  nextRetryAt?: Date;
  errorMessage?: string;
}

export interface StorageHealth {
  backend: string;
  checkTime: Date;
  status: string;
  latencyMs?: number;
  errorRate?: number;
  freeSpaceBytes?: number;
  metadataJson?: string;
}

class CassandraClient {
  private client: Client | null = null;
  private isConnected = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const contactPoints = (process.env.CASSANDRA_HOSTS || 'cassandra').split(',');
    const localDataCenter = process.env.CASSANDRA_DC || 'dc1';
    const keyspace = process.env.CASSANDRA_KEYSPACE || 'ecards_canonical';
    const port = parseInt(process.env.CASSANDRA_PORT || '9042');

    // Configure authentication if provided
    const authProvider = process.env.CASSANDRA_USERNAME && process.env.CASSANDRA_PASSWORD
      ? new auth.PlainTextAuthProvider(
          process.env.CASSANDRA_USERNAME,
          process.env.CASSANDRA_PASSWORD
        )
      : undefined;

    this.client = new Client({
      contactPoints,
      localDataCenter,
      keyspace,
      authProvider,
      protocolOptions: {
        port
      },
      pooling: {
        coreConnectionsPerHost: {
          [CassandraTypes.distance.local]: 2,
          [CassandraTypes.distance.remote]: 1
        },
        maxConnectionsPerHost: {
          [CassandraTypes.distance.local]: 8,
          [CassandraTypes.distance.remote]: 2
        }
      },
      socketOptions: {
        connectTimeout: 10000,
        readTimeout: 12000
      }
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('Connected to Cassandra cluster');
    } catch (error) {
      console.error('Failed to connect to Cassandra:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.shutdown();
      this.isConnected = false;
      console.log('Disconnected from Cassandra cluster');
    } catch (error) {
      console.error('Error disconnecting from Cassandra:', error);
    }
  }

  // Template Event Operations
  async logTemplateEvent(event: Omit<TemplateEvent, 'eventId' | 'createdAt'>): Promise<void> {
    await this.ensureConnected();

    const query = `
      INSERT INTO template_events (
        user_id, template_id, event_id, event_type, storage_mode,
        event_data, sync_status, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      CassandraTypes.Uuid.fromString(event.userId),
      CassandraTypes.Uuid.fromString(event.templateId),
      CassandraTypes.TimeUuid.now(),
      event.eventType,
      event.storageMode,
      event.eventData,
      event.syncStatus || 'synced',
      event.ipAddress || null,
      event.userAgent || null,
      new Date()
    ];

    await this.client!.execute(query, params, { prepare: true });
  }

  async getTemplateEvents(
    userId: string,
    templateId: string,
    limit: number = 100
  ): Promise<TemplateEvent[]> {
    await this.ensureConnected();

    const query = `
      SELECT * FROM template_events
      WHERE user_id = ? AND template_id = ?
      ORDER BY event_id DESC
      LIMIT ?
    `;

    const params = [
      CassandraTypes.Uuid.fromString(userId),
      CassandraTypes.Uuid.fromString(templateId),
      limit
    ];

    const result = await this.client!.execute(query, params, { prepare: true });

    return result.rows.map(row => ({
      userId: row.user_id.toString(),
      templateId: row.template_id.toString(),
      eventId: row.event_id.toString(),
      eventType: row.event_type,
      storageMode: row.storage_mode as StorageMode,
      eventData: row.event_data,
      syncStatus: row.sync_status,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    }));
  }

  // Template Metadata Operations
  async saveTemplateMetadata(metadata: TemplateMetadata): Promise<void> {
    await this.ensureConnected();

    const query = `
      INSERT INTO template_metadata (
        template_id, user_id, full_metadata, event_history,
        audit_trail, storage_modes_used, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      CassandraTypes.Uuid.fromString(metadata.templateId),
      CassandraTypes.Uuid.fromString(metadata.userId),
      metadata.fullMetadata,
      metadata.eventHistory || null,
      metadata.auditTrail || null,
      metadata.storageModesUsed || new Set(),
      metadata.createdAt,
      metadata.updatedAt
    ];

    await this.client!.execute(query, params, { prepare: true });
  }

  async getTemplateMetadata(templateId: string, userId: string): Promise<TemplateMetadata | null> {
    await this.ensureConnected();

    const query = `
      SELECT * FROM template_metadata
      WHERE template_id = ? AND user_id = ?
    `;

    const params = [
      CassandraTypes.Uuid.fromString(templateId),
      CassandraTypes.Uuid.fromString(userId)
    ];

    const result = await this.client!.execute(query, params, { prepare: true });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      templateId: row.template_id.toString(),
      userId: row.user_id.toString(),
      fullMetadata: row.full_metadata,
      eventHistory: row.event_history,
      auditTrail: row.audit_trail,
      storageModesUsed: row.storage_modes_used,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Resource Metadata Operations
  async saveResourceMetadata(resource: ResourceMetadata): Promise<void> {
    await this.ensureConnected();

    const query = `
      INSERT INTO resource_metadata (
        hash, resource_id, original_name, mime_type, size,
        storage_url, storage_mode, reference_count,
        first_seen, last_accessed, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      resource.hash,
      CassandraTypes.Uuid.fromString(resource.resourceId),
      resource.originalName,
      resource.mimeType,
      resource.size,
      resource.storageUrl,
      resource.storageMode,
      resource.referenceCount,
      resource.firstSeen,
      resource.lastAccessed,
      resource.metadataJson || null
    ];

    await this.client!.execute(query, params, { prepare: true });
  }

  async getResourceByHash(hash: string): Promise<ResourceMetadata | null> {
    await this.ensureConnected();

    const query = 'SELECT * FROM resource_metadata WHERE hash = ?';
    const result = await this.client!.execute(query, [hash], { prepare: true });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      hash: row.hash,
      resourceId: row.resource_id.toString(),
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      storageUrl: row.storage_url,
      storageMode: row.storage_mode,
      referenceCount: row.reference_count,
      firstSeen: row.first_seen,
      lastAccessed: row.last_accessed,
      metadataJson: row.metadata_json
    };
  }

  async incrementResourceReference(hash: string): Promise<void> {
    await this.ensureConnected();

    const query = `
      UPDATE resource_metadata
      SET reference_count = reference_count + 1,
          last_accessed = ?
      WHERE hash = ?
    `;

    await this.client!.execute(query, [new Date(), hash], { prepare: true });
  }

  // Mode Transition Operations
  async logModeTransition(transition: Omit<ModeTransition, 'transitionId'>): Promise<void> {
    await this.ensureConnected();

    const query = `
      INSERT INTO mode_transitions (
        user_id, transition_id, from_mode, to_mode,
        trigger, reason, transition_time, success, error_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      CassandraTypes.Uuid.fromString(transition.userId),
      CassandraTypes.TimeUuid.now(),
      transition.fromMode,
      transition.toMode,
      transition.trigger,
      transition.reason,
      transition.transitionTime,
      transition.success,
      transition.errorDetails || null
    ];

    await this.client!.execute(query, params, { prepare: true });
  }

  // Sync Queue Operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'queueId' | 'createdAt'>): Promise<void> {
    await this.ensureConnected();

    const query = `
      INSERT INTO sync_queue (
        user_id, queue_id, item_type, item_id, operation,
        priority, retry_count, max_retries, data_json,
        created_at, next_retry_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      CassandraTypes.Uuid.fromString(item.userId),
      CassandraTypes.Uuid.random(),
      item.itemType,
      CassandraTypes.Uuid.fromString(item.itemId),
      item.operation,
      item.priority,
      item.retryCount,
      item.maxRetries,
      item.dataJson,
      new Date(),
      item.nextRetryAt || null,
      item.errorMessage || null
    ];

    await this.client!.execute(query, params, { prepare: true });
  }

  async getSyncQueueItems(userId: string, limit: number = 100): Promise<SyncQueueItem[]> {
    await this.ensureConnected();

    const query = `
      SELECT * FROM sync_queue
      WHERE user_id = ?
      AND retry_count < max_retries
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `;

    const params = [
      CassandraTypes.Uuid.fromString(userId),
      limit
    ];

    const result = await this.client!.execute(query, params, { prepare: true });

    return result.rows.map(row => ({
      userId: row.user_id.toString(),
      queueId: row.queue_id.toString(),
      itemType: row.item_type,
      itemId: row.item_id.toString(),
      operation: row.operation,
      priority: row.priority,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      dataJson: row.data_json,
      createdAt: row.created_at,
      nextRetryAt: row.next_retry_at,
      errorMessage: row.error_message
    }));
  }

  async removeSyncQueueItem(userId: string, queueId: string): Promise<void> {
    await this.ensureConnected();

    // Since we need all clustering columns, we first need to fetch the item
    const selectQuery = `
      SELECT priority, created_at FROM sync_queue
      WHERE user_id = ? AND queue_id = ?
      ALLOW FILTERING
    `;

    const selectResult = await this.client!.execute(selectQuery, [
      CassandraTypes.Uuid.fromString(userId),
      CassandraTypes.Uuid.fromString(queueId)
    ]);

    if (selectResult.rows.length > 0) {
      const row = selectResult.rows[0];
      const deleteQuery = `
        DELETE FROM sync_queue
        WHERE user_id = ? AND priority = ? AND created_at = ? AND queue_id = ?
      `;

      await this.client!.execute(deleteQuery, [
        CassandraTypes.Uuid.fromString(userId),
        row.priority,
        row.created_at,
        CassandraTypes.Uuid.fromString(queueId)
      ], { prepare: true });
    }
  }

  // Storage Health Operations
  async logStorageHealth(health: StorageHealth): Promise<void> {
    await this.ensureConnected();

    const query = `
      INSERT INTO storage_health (
        backend, check_time, status, latency_ms,
        error_rate, free_space_bytes, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      health.backend,
      health.checkTime,
      health.status,
      health.latencyMs || null,
      health.errorRate || null,
      health.freeSpaceBytes || null,
      health.metadataJson || null
    ];

    await this.client!.execute(query, params, { prepare: true });
  }

  async getStorageHealth(backend: string, limit: number = 10): Promise<StorageHealth[]> {
    await this.ensureConnected();

    const query = `
      SELECT * FROM storage_health
      WHERE backend = ?
      ORDER BY check_time DESC
      LIMIT ?
    `;

    const result = await this.client!.execute(query, [backend, limit], { prepare: true });

    return result.rows.map(row => ({
      backend: row.backend,
      checkTime: row.check_time,
      status: row.status,
      latencyMs: row.latency_ms,
      errorRate: row.error_rate,
      freeSpaceBytes: row.free_space_bytes,
      metadataJson: row.metadata_json
    }));
  }

  // Utility method to ensure connection
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureConnected();
      const result = await this.client!.execute('SELECT now() FROM system.local');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Cassandra health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cassandraClient = new CassandraClient();

// Export TimeUuid utility for external use
export const TimeUuid = CassandraTypes.TimeUuid;
export const Uuid = CassandraTypes.Uuid;