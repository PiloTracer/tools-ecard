/**
 * Card rendering job handler
 * Processes card-rendering jobs from BullMQ queue
 */

import type { Job } from 'bullmq';
import { renderCard } from '../services/renderer';
import { uploadToStorage, buildCardStorageKey } from '../services/storage';
import { workerConfig } from '../core/config';

export type RenderCardJob = {
  templateId: string;
  recordId: string;
  batchId: string;
  width?: number;
  height?: number;
};

export async function processRenderCard(job: Job<RenderCardJob>): Promise<{
  success: boolean;
  recordId: string;
  size?: string;
  storageUrl?: string;
}> {
  const { templateId, recordId, batchId, width, height } = job.data;

  console.log(`🎨 Rendering card:`, {
    templateId,
    recordId,
    batchId,
    engine: workerConfig.worker.renderEngine,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Render the card using Node.js canvas
    await job.updateProgress(10);

    const result = await renderCard({
      templateId,
      recordId,
      batchId,
      width,
      height,
    });

    await job.updateProgress(40);

    console.log(`✅ Card rendered: ${recordId} (${result.width}x${result.height}, ${(result.buffer.length / 1024).toFixed(1)}KB)`);

    // Store rendered card to S3
    await job.updateProgress(60);

    const storageKey = buildCardStorageKey(batchId, recordId);
    const uploadResult = await uploadToStorage({
      key: storageKey,
      body: result.buffer,
      contentType: 'image/png',
    });

    console.log(`📤 Card uploaded to S3: ${uploadResult.bucket}/${uploadResult.key}`);

    await job.updateProgress(80);

    // TODO [M1-T3]: Update job status in database with storage URL
    // 1. Update batch record with rendered card URL
    // 2. This enables frontend to show the rendered card

    await job.updateProgress(100);

    return {
      success: true,
      recordId,
      size: `${result.width}x${result.height}`,
      storageUrl: `${uploadResult.bucket}/${uploadResult.key}`,
    };
  } catch (error) {
    console.error(`❌ Render failed for ${recordId}:`, error instanceof Error ? error.message : error);
    throw error; // Let BullMQ handle retries
  }
}
