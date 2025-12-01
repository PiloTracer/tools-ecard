import Bull from 'bull';
import { BatchProcessingJob, BATCH_PARSE_QUEUE } from '../types';

export class QueueService {
  private parseQueue: Bull.Queue<BatchProcessingJob>;

  constructor() {
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;

    const redisConfig: Bull.QueueOptions = {
      redis: {
        host: redisHost,
        port: redisPort,
        ...(redisPassword && { password: redisPassword }),
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    };

    this.parseQueue = new Bull(BATCH_PARSE_QUEUE, redisConfig);

    // Set up error handling
    this.parseQueue.on('error', (error) => {
      console.error('Queue error:', error);
    });

    this.parseQueue.on('failed', (job, error) => {
      console.error(`Job ${job.id} failed:`, error);
    });
  }

  async enqueueBatchParsing(job: BatchProcessingJob): Promise<string> {
    try {
      const queuedJob = await this.parseQueue.add('parse-batch', job, {
        delay: 1000, // Delay by 1 second to ensure file is fully saved
        priority: 1,
      });

      console.log(`Batch parsing job queued: ${queuedJob.id}`);
      return queuedJob.id as string;
    } catch (error) {
      console.error('Failed to enqueue batch parsing job:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: any;
    failedReason?: string;
  }> {
    const job = await this.parseQueue.getJob(jobId);

    if (!job) {
      return { status: 'not_found', progress: 0 };
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      data: job.data,
      ...(state === 'failed' && { failedReason: job.failedReason }),
    };
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.parseQueue.getWaitingCount(),
      this.parseQueue.getActiveCount(),
      this.parseQueue.getCompletedCount(),
      this.parseQueue.getFailedCount(),
      this.parseQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async cleanQueue(grace: number = 5000): Promise<void> {
    // Clean completed jobs older than grace period
    await this.parseQueue.clean(grace, 'completed');

    // Clean failed jobs older than 24 hours
    await this.parseQueue.clean(24 * 60 * 60 * 1000, 'failed');
  }

  async close(): Promise<void> {
    await this.parseQueue.close();
  }
}

// Export singleton instance
export const queueService = new QueueService();