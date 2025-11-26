/**
 * Batch View Service
 * Business logic for viewing and managing batches
 */

import { batchRepository } from '../../batch-upload/repositories/batchRepository';
import { batchRecordRepository } from '../../batch-parsing/repositories/batchRecordRepository';
import { prisma } from '../../../core/database/prisma';
import { cassandraClient } from '../../../core/cassandra/client';
import { types as CassandraTypes } from 'cassandra-driver';
import { BatchStatus } from '@prisma/client';

export interface ListBatchesFilters {
  status?: BatchStatus;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListBatchesOptions {
  page?: number;
  pageSize?: number;
  filters?: ListBatchesFilters;
}

export class BatchViewService {
  /**
   * List batches for a user with pagination and filters
   */
  async listBatches(userId: string, options: ListBatchesOptions = {}) {
    const {
      page = 1,
      pageSize = 20,
      filters = {},
    } = options;

    // Validate pagination
    if (pageSize > 100) {
      throw new Error('Page size cannot exceed 100');
    }

    const { batches, total } = await batchRepository.findByUserId(userId, {
      status: filters.status,
      page,
      limit: pageSize,
    });

    // Apply client-side search if provided
    let filteredBatches = batches;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredBatches = batches.filter((batch) =>
        batch.fileName.toLowerCase().includes(searchLower)
      );
    }

    return {
      batches: filteredBatches,
      pagination: {
        total: filters.search ? filteredBatches.length : total,
        page,
        pageSize,
        totalPages: Math.ceil((filters.search ? filteredBatches.length : total) / pageSize),
      },
    };
  }

  /**
   * Get a single batch by ID with ownership verification
   */
  async getBatchById(batchId: string, userId: string) {
    const batch = await batchRepository.findByUserIdAndId(userId, batchId);

    if (!batch) {
      throw new Error('Batch not found or access denied');
    }

    // Get record count
    const recordCount = await batchRecordRepository.getRecordCountByBatchId(batchId);

    return {
      ...batch,
      recordCount,
    };
  }

  /**
   * Delete a batch and all associated records
   * Deletes from both PostgreSQL and Cassandra
   */
  async deleteBatch(batchId: string, userId: string): Promise<{ success: boolean; deletedRecordsCount: number }> {
    // 1. Verify ownership
    const batch = await batchRepository.findByUserIdAndId(userId, batchId);
    if (!batch) {
      throw new Error('Batch not found or access denied');
    }

    // 2. Get record count before deletion
    const recordCount = await batchRecordRepository.getRecordCountByBatchId(batchId);

    try {
      // 3. Delete from Cassandra first (no foreign key constraints)
      await this.deleteCassandraRecords(batchId);

      // 4. Delete from PostgreSQL (CASCADE will delete batch_records)
      await batchRepository.delete(batchId);

      return {
        success: true,
        deletedRecordsCount: recordCount,
      };
    } catch (error) {
      console.error('Error deleting batch:', error);
      throw new Error('Failed to delete batch: ' + (error as Error).message);
    }
  }

  /**
   * Delete all Cassandra contact_records for a batch
   */
  private async deleteCassandraRecords(batchId: string): Promise<void> {
    try {
      await cassandraClient.connect();

      // Note: Using the actual table name from the system (contact_records)
      // If using batch_records, update the query accordingly
      const query = `DELETE FROM contact_records WHERE batch_id = ?`;

      await cassandraClient['client']!.execute(
        query,
        [CassandraTypes.Uuid.fromString(batchId)],
        { prepare: true }
      );

      console.log(`Deleted Cassandra records for batch ${batchId}`);
    } catch (error) {
      console.error('Error deleting Cassandra records:', error);
      throw error;
    }
  }

  /**
   * Get batch statistics for a user
   */
  async getBatchStats(userId: string) {
    return await batchRepository.getBatchStats(userId);
  }
}

// Export singleton instance
export const batchViewService = new BatchViewService();
