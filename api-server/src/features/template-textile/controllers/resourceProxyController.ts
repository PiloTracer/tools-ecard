import { FastifyRequest, FastifyReply } from 'fastify';
import { getS3Service } from '../../s3-bucket/services/s3Service';
import { gunzipSync, inflateSync } from 'zlib';

interface ResourceProxyParams {
  bucket: string;
  '*': string;
}

export class ResourceProxyController {
  /**
   * Proxy resource from S3 to browser
   */
  async getResource(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as ResourceProxyParams;
      const bucket = params.bucket;
      const key = params['*'];

      console.log('[ResourceProxy] Fetching:', bucket, key);

      const s3Service = getS3Service();
      const s3Result = await s3Service.getObject(bucket, key);

      console.log('[ResourceProxy] Got S3 result, converting to buffer...');

      // Convert body (Readable or Buffer) to Buffer
      let buffer: Buffer;
      if (Buffer.isBuffer(s3Result.body)) {
        buffer = s3Result.body;
        console.log('[ResourceProxy] Body was already a buffer');
      } else {
        // Convert Readable stream to Buffer
        const chunks: Buffer[] = [];
        for await (const chunk of s3Result.body) {
          chunks.push(Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
        console.log('[ResourceProxy] Converted stream to buffer');
      }

      console.log('[ResourceProxy] Buffer length:', buffer.length, 'magic bytes:', buffer[0]?.toString(16), buffer[1]?.toString(16));

      // Try to decompress if compressed (SeaweedFS compresses files)
      try {
        // Check if data looks compressed
        if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
          // Gzip magic number
          console.log('[ResourceProxy] Decompressing gzip data');
          buffer = gunzipSync(buffer);
        } else if (buffer[0] === 0x78 && (buffer[1] === 0x01 || buffer[1] === 0x9c || buffer[1] === 0xda)) {
          // Deflate magic number
          console.log('[ResourceProxy] Decompressing deflate data');
          buffer = inflateSync(buffer);
        } else {
          console.log('[ResourceProxy] Data not compressed, sending as-is');
        }
      } catch (decompressError) {
        // If decompression fails, use original buffer
        console.warn('[ResourceProxy] Decompression failed, using raw buffer:', decompressError);
      }

      console.log('[ResourceProxy] Sending buffer, final length:', buffer.length);

      // Set appropriate headers
      reply.header('Content-Type', s3Result.contentType || 'application/octet-stream');
      reply.header('Content-Length', buffer.length);
      reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      reply.header('Access-Control-Allow-Origin', '*'); // Allow CORS

      return reply.send(buffer);
    } catch (error) {
      console.error('[ResourceProxy] Error:', error);
      return reply.status(404).send({
        success: false,
        error: error instanceof Error ? error.message : 'Resource not found'
      });
    }
  }
}

export const resourceProxyController = new ResourceProxyController();
