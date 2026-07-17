/**
 * Download template JSON and related assets from storage URLs used by api-server.
 */

import { readFile } from 'fs/promises';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { workerConfig } from '../core/config';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const { endpoint, accessKey, secretKey } = workerConfig.seaweedfs;
    if (!endpoint) {
      throw new Error('SeaweedFS endpoint not configured');
    }
    s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey || 'access_key',
        secretAccessKey: secretKey || 'secret_key',
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body && typeof (body as NodeJS.ReadableStream).pipe === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Unsupported S3 response body');
}

export async function downloadTemplateJson(storageUrl: string): Promise<Record<string, unknown>> {
  if (storageUrl.startsWith('s3://')) {
    const parts = storageUrl.replace('s3://', '').split('/');
    const bucket = parts[0];
    const key = parts.slice(1).join('/');
    const client = getS3Client();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buffer = await streamToBuffer(result.Body);
    return JSON.parse(buffer.toString('utf-8')) as Record<string, unknown>;
  }

  if (storageUrl.startsWith('fallback://')) {
    const filePath = storageUrl.replace('fallback://', '');
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  }

  if (storageUrl.startsWith('local://')) {
    throw new Error(`Cannot load template from local:// URL in worker: ${storageUrl}`);
  }

  throw new Error(`Unknown template storage URL: ${storageUrl}`);
}
