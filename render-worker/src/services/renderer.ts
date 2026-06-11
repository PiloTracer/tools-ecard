/**
 * Card rendering service
 * Uses Node.js canvas to render card templates
 */

import { createCanvas } from 'canvas';
import { prisma } from '../core/database';

export interface RenderOptions {
  templateId: string;
  recordId: string;
  batchId: string;
  width?: number;
  height?: number;
}

export interface RenderResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'png';
}

/**
 * Render a card from template data
 * 
 * Flow:
 * 1. Load template metadata from database
 * 2. Load template JSON (Fabric.js canvas data) from storage
 * 3. Create canvas with template dimensions
 * 4. Render template elements
 * 5. Return PNG buffer
 */
export async function renderCard(options: RenderOptions): Promise<RenderResult> {
  const { templateId, width, height } = options;

  // Load template metadata from database
  const template = await prisma.templateMetadata.findUnique({
    where: { id: templateId },
    include: { resources: true },
  });

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const canvasWidth = width || template.exportWidth || template.width;
  const canvasHeight = height || template.exportHeight || template.height;

  // Create canvas with template dimensions
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Draw white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw template border (visual aid during development)
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);

  // Draw dimensions label
  ctx.fillStyle = '#999999';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${canvasWidth} x ${canvasHeight}`, canvasWidth / 2, canvasHeight / 2);

  // TODO [M1-T1 extension]: Parse Fabric.js template JSON and render elements
  // 1. Load template JSON from storageUrl (S3/local)
  // 2. Parse Fabric.js objects (rectangles, text, images, QR codes)
  // 3. Render each element using canvas API
  // 4. Apply fonts, colors, and layout transforms
  //
  // See front-cards/features/template-textile/services/canvasRenderer.ts
  // for reference on how Fabric.js JSON is interpreted client-side.

  const buffer = canvas.toBuffer('image/png');

  return {
    buffer,
    width: canvasWidth,
    height: canvasHeight,
    format: 'png',
  };
}
