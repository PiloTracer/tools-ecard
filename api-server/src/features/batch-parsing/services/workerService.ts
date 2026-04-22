/**
 * Batch Parsing Worker Service
 * Processes queued batch parsing jobs from Bull/Redis
 * Integrates with Python parser via batchParsingService
 */

import Bull from 'bull';
import { createLogger } from '../../../core/utils/logger';
import { BatchProcessingJob, BATCH_PARSE_QUEUE } from '../../batch-upload/types';
import { batchParsingService } from './batchParsingService';

const log = createLogger('BatchParsingWorker');

export class BatchParsingWorkerService {
  private parseQueue: Bull.Queue<BatchProcessingJob> | null = null;
  private isProcessing: boolean = false;

  constructor() {
    // Queue is created on first start()
  }

  private initializeQueue(): Bull.Queue<BatchProcessingJob> {
    if (this.parseQueue) {
      return this.parseQueue;
    }

    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;

    const redisConfig: Bull.QueueOptions = {
      redis: {
        host: redisHost,
        port: redisPort,
        ...(redisPassword && { password: redisPassword }),
      },
    };

    this.parseQueue = new Bull(BATCH_PARSE_QUEUE, redisConfig);

    this.parseQueue.on('error', (error) => {
      log.error({ err: error }, 'Batch parse queue error');
    });

    this.parseQueue.on('failed', (job, error) => {
      log.error({ jobId: job.id, err: error }, 'Batch parse job failed');
    });

    return this.parseQueue;
  }

  private setupProcessor(): void {
    const queue = this.initializeQueue();

    queue.process('parse-batch', 1, async (job) => {
      const { batchId, filePath, userEmail, workPhonePrefix, defaultCountryCode } = job.data;
      log.info({ jobId: job.id, batchId }, 'Processing batch parse job');

      try {
        // Update job progress
        await job.progress(10);

        // Call Python parser via batchParsingService
        const result = await batchParsingService.parseBatch({
          batchId,
          filePath,
          verbose: false,
          workPhonePrefix,
          defaultCountryCode,
        });

        await job.progress(90);

        if (result.success) {
          log.info(
            { batchId, recordsProcessed: result.records_processed, recordsTotal: result.records_total },
            'Batch parse completed'
          );

          // Update job progress to 100%
          await job.progress(100);

          // Return result (stored in job.returnvalue)
          return {
            success: true,
            batchId,
            recordsProcessed: result.records_processed,
            recordsTotal: result.records_total
          };
        } else {
          throw new Error(result.error || 'Unknown parsing error');
        }

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        log.error({ jobId: job.id, batchId: job.data.batchId, err: error }, 'Batch parsing job failed');
        throw new Error(`Batch parsing failed: ${message}`);
      }
    });

    this.isProcessing = true;
    log.info('Batch parse job processor ready');
  }

  async start(): Promise<void> {
    if (this.isProcessing) {
      log.warn('Batch parsing worker already started');
      return;
    }

    try {
      this.setupProcessor();
      const redisHost = process.env.REDIS_HOST || 'redis';
      const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
      log.info({ redisHost, redisPort }, 'Batch parsing worker started');
    } catch (error: unknown) {
      log.error({ err: error }, 'Failed to start batch parsing worker');
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.parseQueue) {
      return;
    }

    log.info('Stopping batch parsing worker');
    await this.parseQueue.close();
    this.isProcessing = false;
    this.parseQueue = null;
    log.info('Batch parsing worker stopped');
  }

  async getWorkerStats(): Promise<{
    isProcessing: boolean;
    queueStats: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  }> {
    if (!this.parseQueue) {
      return {
        isProcessing: false,
        queueStats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0
        }
      };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.parseQueue.getWaitingCount(),
      this.parseQueue.getActiveCount(),
      this.parseQueue.getCompletedCount(),
      this.parseQueue.getFailedCount(),
      this.parseQueue.getDelayedCount(),
    ]);

    return {
      isProcessing: this.isProcessing,
      queueStats: {
        waiting,
        active,
        completed,
        failed,
        delayed
      }
    };
  }
}

// Export singleton instance
export const batchParsingWorker = new BatchParsingWorkerService();
