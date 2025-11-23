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
import { batchRepository } from '../repositories/batchRepository';
import { storageService } from './storageService';
import { queueService } from './queueService';

export class BatchUploadService {
  async uploadBatch(request: BatchUploadRequest): Promise<BatchUploadResponse> {
    const { file, userId, userEmail, projectId, projectName } = request;

    try {
      // 1. Upload file to storage (SeaweedFS or local) - use projectId for consistent paths
      const uploadResult = await storageService.uploadBatchFile(file, userEmail, projectId);

      // 2. Create batch record in database
      const batch = await batchRepository.create({
        userId,
        userEmail,
        projectId,
        projectName,
        fileName: file.originalname,
        fileSize: file.size,
        filePath: uploadResult.filePath,
        status: BatchStatus.UPLOADED,
      });

      // 3. Enqueue async job for batch parsing
      const job: BatchProcessingJob = {
        batchId: batch.id,
        filePath: uploadResult.filePath,
        userEmail,
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
        progress = 10;
        break;
      case BatchStatus.PARSING:
        progress = 50;
        break;
      case BatchStatus.PARSED:
        progress = 80;
        break;
      case BatchStatus.LOADED:
        progress = 100;
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

  async retryBatch(userId: string, batchId: string): Promise<BatchUploadResponse> {
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

    // Update status to UPLOADED
    await batchRepository.updateStatus(batch.id, BatchStatus.UPLOADED);

    // Re-enqueue for processing
    const job: BatchProcessingJob = {
      batchId: batch.id,
      filePath: batch.filePath,
      userEmail: batch.userEmail,
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