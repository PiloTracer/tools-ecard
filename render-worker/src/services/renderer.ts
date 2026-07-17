/**
 * Card rendering service — loads template JSON + batch record, renders PNG via node-canvas.
 */

import { prisma } from '../core/database';
import { downloadTemplateJson } from './templateStorage';
import {
  renderTemplateToPng,
  type RecordFieldValues,
  type TemplateJson,
} from './fabricTemplateRenderer';

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

export async function renderCard(options: RenderOptions): Promise<RenderResult> {
  const { templateId, recordId } = options;

  const template = await prisma.templateMetadata.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const templateJson = (await downloadTemplateJson(template.storageUrl)) as unknown as TemplateJson;

  const record = await prisma.batchRecord.findUnique({
    where: { id: recordId },
  });

  const fieldValues: RecordFieldValues | undefined = record
    ? {
        fullName: record.fullName,
        email: record.email,
        workPhone: record.workPhone,
        mobilePhone: record.mobilePhone,
        businessName: record.businessName,
      }
    : undefined;

  const result = await renderTemplateToPng(templateJson, fieldValues);

  return {
    buffer: result.buffer,
    width: options.width ?? result.width,
    height: options.height ?? result.height,
    format: 'png',
  };
}
