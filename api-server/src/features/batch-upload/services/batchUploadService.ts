import { BatchStatus } from '@prisma/client';
import {
  BatchUploadRequest,
  BatchUploadResponse,
  BatchStatusResponse,
  ListBatchesQuery,
  ListBatchesResponse,
  BatchListItem,
  BatchUploadError,
  BatchProcessingJob,
} from '../types';
import type { FieldMapping } from '../../batch-import/types';
import { batchRepository } from '../repositories/batchRepository';
import { storageService } from './storageService';
import { queueService } from './queueService';
import { prisma } from '../../../core/database/prisma';
import { batchRecordRepository } from '../../batch-parsing/repositories/batchRecordRepository';
import { resolveServerBatchRecordLimit } from '../../../core/limits/batchRecordLimit';

export class BatchUploadService {
  async uploadBatch(request: BatchUploadRequest): Promise<BatchUploadResponse> {
    const { file, userId, userEmail, projectId, projectName, mapping } = request;
    // Caller (authenticated Fastify route) passes the per-user resolved limit;
    // legacy/anonymous paths omit it. Always fall back to server env/fallback so
    // the limit is never silently undefined (= unlimited) downstream.
    const batchRecordLimit =
      request.batchRecordLimit ?? resolveServerBatchRecordLimit(null).limit;

    try {
      // 1. Fetch project configuration for phone formatting
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          workPhonePrefix: true,
          defaultCountryCode: true,
        },
      });

      // 2. Upload file to storage (SeaweedFS or local) - use projectId for consistent paths
      const uploadResult = await storageService.uploadBatchFile(file, userEmail, projectId);

      // 3. Create batch record in database (persisting the explicit mapping, if
      // any, so a later retry re-applies it)
      const batch = await batchRepository.create({
        userId,
        userEmail,
        projectId,
        projectName,
        fileName: file.originalname,
        fileSize: file.size,
        filePath: uploadResult.filePath,
        status: BatchStatus.UPLOADED,
        fieldMapping: mapping,
      });

      // 4. Enqueue async job for batch parsing with phone config
      const job: BatchProcessingJob = {
        batchId: batch.id,
        filePath: uploadResult.filePath,
        userEmail,
        batchRecordLimit,
        workPhonePrefix: project?.workPhonePrefix ?? undefined,
        defaultCountryCode: project?.defaultCountryCode ?? undefined,
        mapping,
      };

      await queueService.enqueueBatchParsing(job);

      return {
        id: batch.id,
        status: batch.status,
        message: 'File uploaded successfully. Processing will begin shortly.',
      };
    } catch (error) {
      console.error('Batch upload error:', error);

      if (error instanceof BatchUploadError) {
        throw error;
      }

      throw new BatchUploadError(
        'Failed to upload batch file',
        'UPLOAD_FAILED',
        500
      );
    }
  }

  /**
   * Full batch row + Cassandra record count (for batch-view UI: GET /api/batches/:id).
   */
  async getBatchDetail(userId: string, batchId: string) {
    const batch = await batchRepository.findByUserIdAndId(userId, batchId);

    if (!batch) {
      throw new BatchUploadError(
        'Batch not found',
        'BATCH_NOT_FOUND',
        404
      );
    }

    const recordCount = await batchRecordRepository.getRecordCountByBatchId(batchId);

    return {
      batch: {
        id: batch.id,
        fileName: batch.fileName,
        fileSize: batch.fileSize,
        status: batch.status,
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
        processedAt: batch.processedAt?.toISOString() ?? null,
        recordsCount: recordCount,
        recordsProcessed: batch.recordsProcessed,
        parsingStartedAt: batch.parsingStartedAt?.toISOString() ?? null,
        parsingCompletedAt: batch.parsingCompletedAt?.toISOString() ?? null,
      },
    };
  }

  async getBatchStatus(userId: string, batchId: string): Promise<BatchStatusResponse> {
    const batch = await batchRepository.findByUserIdAndId(userId, batchId);

    if (!batch) {
      throw new BatchUploadError(
        'Batch not found',
        'BATCH_NOT_FOUND',
        404
      );
    }

    // Calculate progress based on status
    let progress = 0;
    switch (batch.status) {
      case BatchStatus.UPLOADED:
        progress = 20;  // File uploaded to storage
        break;
      case BatchStatus.PARSING:
        progress = 40;  // Python parser processing
        break;
      case BatchStatus.PARSED:
        progress = 80;  // Records inserted into databases
        break;
      case BatchStatus.LOADED:
        progress = 100; // Fully loaded and ready for use
        break;
      case BatchStatus.ERROR:
        progress = 0;
        break;
    }

    return {
      id: batch.id,
      status: batch.status,
      progress,
      errorMessage: batch.errorMessage,
      fileName: batch.fileName,
      fileSize: batch.fileSize,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      processedAt: batch.processedAt,
    };
  }

  async listUserBatches(
    userId: string,
    query: ListBatchesQuery
  ): Promise<ListBatchesResponse> {
    const { page = 1, limit = 20 } = query;
    const { batches, total } = await batchRepository.findByUserId(userId, query);

    const batchItems: BatchListItem[] = batches.map((batch) => ({
      id: batch.id,
      fileName: batch.fileName,
      fileSize: batch.fileSize,
      status: batch.status,
      errorMessage: batch.errorMessage,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      processedAt: batch.processedAt,
      recordsCount: batch.recordsCount,
      recordsProcessed: batch.recordsProcessed,
      parsingStartedAt: batch.parsingStartedAt,
      parsingCompletedAt: batch.parsingCompletedAt,
    }));

    return {
      batches: batchItems,
      total,
      page,
      limit,
    };
  }

  async deleteBatch(userId: string, batchId: string): Promise<void> {
    const batch = await batchRepository.findByUserIdAndId(userId, batchId);

    if (!batch) {
      throw new BatchUploadError(
        'Batch not found',
        'BATCH_NOT_FOUND',
        404
      );
    }

    // Delete file from storage (best effort, don't fail if file doesn't exist)
    await storageService.deleteFile(batch.filePath);

    // Delete batch record from database
    await batchRepository.delete(batchId);
  }

  async retryBatch(
    userId: string,
    batchId: string,
    batchRecordLimit?: number
  ): Promise<BatchUploadResponse> {
    const resolvedLimit = batchRecordLimit ?? resolveServerBatchRecordLimit(null).limit;
    const batch = await batchRepository.findByUserIdAndId(userId, batchId);

    if (!batch) {
      throw new BatchUploadError(
        'Batch not found',
        'BATCH_NOT_FOUND',
        404
      );
    }

    if (batch.status !== BatchStatus.ERROR) {
      throw new BatchUploadError(
        'Only failed batches can be retried',
        'INVALID_STATUS',
        400
      );
    }

    // Fetch project configuration for phone formatting
    const project = await prisma.project.findUnique({
      where: { id: batch.projectId },
      select: {
        workPhonePrefix: true,
        defaultCountryCode: true,
      },
    });

    // Update status to UPLOADED
    await batchRepository.updateStatus(batch.id, BatchStatus.UPLOADED);

    // Re-enqueue for processing with phone config. The explicit field mapping
    // saved at upload time (Pass 3) is re-applied on retry.
    const job: BatchProcessingJob = {
      batchId: batch.id,
      filePath: batch.filePath,
      userEmail: batch.userEmail,
      batchRecordLimit: resolvedLimit,
      workPhonePrefix: project?.workPhonePrefix ?? undefined,
      defaultCountryCode: project?.defaultCountryCode ?? undefined,
      mapping: (batch.fieldMapping as unknown as FieldMapping[] | null) ?? undefined,
    };

    await queueService.enqueueBatchParsing(job);

    return {
      id: batch.id,
      status: BatchStatus.UPLOADED,
      message: 'Batch retry initiated. Processing will begin shortly.',
    };
  }

  async getBatchStats(userId: string) {
    return await batchRepository.getBatchStats(userId);
  }

  async getRecentBatches(userId: string, limit: number = 5) {
    const batches = await batchRepository.getRecentBatches(userId, limit);

    return batches.map((batch) => ({
      id: batch.id,
      fileName: batch.fileName,
      fileSize: batch.fileSize,
      status: batch.status,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    }));
  }

  async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    errorMessage?: string
  ): Promise<void> {
    await batchRepository.updateStatus(batchId, status, errorMessage);
  }
}

// Export singleton instance
export const batchUploadService = new BatchUploadService();