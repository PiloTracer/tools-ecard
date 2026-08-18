/**
 * Card rendering service — loads template JSON + batch record, renders PNG via node-canvas.
 */

import { prisma } from '../core/database';
import { getFullContactRecord, type FullContactRecord } from '../core/database/cassandra';
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

  // PostgreSQL mirrors only the 5 searchable fields; the FULL record (all
  // 28 vCard fields) lives in Cassandra. Load it so every field dropped on
  // the designer renders on the card — falling back to the PG row when the
  // Cassandra record is missing (legacy batches, delete, Cassandra down).
  const [pgRecord, fullRecord] = await Promise.all([
    prisma.batchRecord.findUnique({ where: { id: recordId } }),
    getFullContactRecord(recordId),
  ]);

  const fieldValues: RecordFieldValues | undefined = fullRecord
    ? {
        fullName: fullRecord.fullName ?? null,
        firstName: fullRecord.firstName ?? null,
        lastName: fullRecord.lastName ?? null,
        email: fullRecord.email ?? null,
        workPhone: fullRecord.workPhone ?? null,
        workPhoneExt: fullRecord.workPhoneExt ?? null,
        mobilePhone: fullRecord.mobilePhone ?? null,
        businessName: fullRecord.businessName ?? null,
        businessTitle: fullRecord.businessTitle ?? null,
        addressStreet: fullRecord.addressStreet ?? null,
        addressCity: fullRecord.addressCity ?? null,
        addressState: fullRecord.addressState ?? null,
        addressPostal: fullRecord.addressPostal ?? null,
        addressCountry: fullRecord.addressCountry ?? null,
        socialInstagram: fullRecord.socialInstagram ?? null,
        socialTwitter: fullRecord.socialTwitter ?? null,
        socialFacebook: fullRecord.socialFacebook ?? null,
        businessDepartment: fullRecord.businessDepartment ?? null,
        businessUrl: fullRecord.businessUrl ?? null,
        businessHours: fullRecord.businessHours ?? null,
        businessAddressStreet: fullRecord.businessAddressStreet ?? null,
        businessAddressCity: fullRecord.businessAddressCity ?? null,
        businessAddressState: fullRecord.businessAddressState ?? null,
        businessAddressPostal: fullRecord.businessAddressPostal ?? null,
        businessAddressCountry: fullRecord.businessAddressCountry ?? null,
        businessLinkedin: fullRecord.businessLinkedin ?? null,
        businessTwitter: fullRecord.businessTwitter ?? null,
        personalUrl: fullRecord.personalUrl ?? null,
        personalBio: fullRecord.personalBio ?? null,
        personalBirthday: fullRecord.personalBirthday ?? null,
      }
    : pgRecord
      ? {
          fullName: pgRecord.fullName,
          email: pgRecord.email,
          workPhone: pgRecord.workPhone,
          mobilePhone: pgRecord.mobilePhone,
          businessName: pgRecord.businessName,
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
