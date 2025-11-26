/**
 * Batch Parsing Worker Service
 * Processes queued batch parsing jobs from Bull/Redis
 * Integrates with Python parser via batchParsingService
 */

import Bull from 'bull';
import { BatchProcessingJob, BATCH_PARSE_QUEUE } from '../../batch-upload/types';
import { batchParsingService } from './batchParsingService';

export class BatchParsingWorkerService {
  private parseQueue: Bull.Queue<BatchProcessingJob> | null = null;
  private isProcessing: boolean = false;

  constructor() {
    // Don't initialize queue in constructor - wait for explicit start()
    console.log('🔧 BatchParsingWorkerService constructor called');
  }

  private initializeQueue(): Bull.Queue<BatchProcessingJob> {
    if (this.parseQueue) {
      return this.parseQueue;
    }

    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;

    console.log(`🔌 Connecting to Redis: ${redisHost}:${redisPort}`);

    const redisConfig: Bull.QueueOptions = {
      redis: {
        host: redisHost,
        port: redisPort,
        ...(redisPassword && { password: redisPassword }),
      },
    };

    this.parseQueue = new Bull(BATCH_PARSE_QUEUE, redisConfig);

    // Set up error handlers immediately
    this.parseQueue.on('error', (error) => {
      console.error('❌ Queue error:', error);
    });

    this.parseQueue.on('failed', (job, error) => {
      console.error(`❌ Job ${job.id} failed:`, error.message);
    });

    console.log('✅ Redis queue initialized');
    return this.parseQueue;
  }

  private setupProcessor(): void {
    const queue = this.initializeQueue();

    console.log('📋 Setting up job processor...');

    // Process jobs with concurrency of 1 (sequential processing)
    queue.process('parse-batch', 1, async (job) => {
      console.log(`📋 Processing batch parsing job ${job.id}...`);

      const { batchId, filePath, userEmail } = job.data;

      try {
        // Update job progress
        await job.progress(10);

        // Call Python parser via batchParsingService
        const result = await batchParsingService.parseBatch({
          batchId,
          filePath,
          verbose: false
        });

        await job.progress(90);

        if (result.success) {
          console.log(`✅ Batch ${batchId} parsed successfully: ${result.records_processed}/${result.records_total} records`);

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

      } catch (error: any) {
        console.error(`❌ Batch parsing job ${job.id} failed:`, error);
        throw new Error(`Batch parsing failed: ${error.message}`);
      }
    });

    // Event handlers
    queue.on('active', (job) => {
      console.log(`🔄 Job ${job.id} started processing`);
    });

    queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed successfully:`, result);
    });

    this.isProcessing = true;
    console.log('✅ Batch parsing job processor setup complete');
  }

  async start(): Promise<void> {
    if (this.isProcessing) {
      console.log('⚠️  Worker already started');
      return;
    }

    try {
      console.log('🚀 Starting batch parsing worker...');
      this.setupProcessor();
      console.log('✅ Batch parsing worker started successfully');
    } catch (error: any) {
      console.error('❌ Failed to start batch parsing worker:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.parseQueue) {
      console.log('⚠️  Worker not started, nothing to stop');
      return;
    }

    console.log('⏹️  Stopping batch parsing worker...');
    await this.parseQueue.close();
    this.isProcessing = false;
    this.parseQueue = null;
    console.log('✅ Batch parsing worker stopped');
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
