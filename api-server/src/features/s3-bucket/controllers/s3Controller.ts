/**
 * S3 Controller - API Request Handlers
 *
 * This controller handles HTTP requests for S3 storage operations,
 * integrating with the S3 service to interact with SeaweedFS.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getS3Service } from '../services/s3Service';
import { DEFAULT_BUCKETS } from '../config/s3Config';
import {
  type UploadFileRequest,
  type PresignedUrlRequest,
  type ListObjectsRequest,
  type DeleteObjectsRequest,
  S3_CONSTANTS,
  InvalidRequestError
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';
import { Readable } from 'stream';

const s3Service = getS3Service();

/**
 * S3 Controller class with all endpoint handlers
 */
export class S3Controller {
  /**
   * Upload a file to S3
   * POST /api/v1/s3/objects
   */
  async uploadFile(
    request: FastifyRequest<{ Body: UploadFileRequest }>,
    reply: FastifyReply
  ) {
    try {
      const { file, bucket = DEFAULT_BUCKETS.USERS, prefix = '', metadata } = request.body;

      // Validate file
      if (!file || !file.data) {
        throw new InvalidRequestError('No file provided');
      }

      // Generate unique key
      const fileExtension = mime.extension(file.mimetype) || 'bin';
      const uniqueId = uuidv4();
      const key = prefix
        ? `${prefix}/${uniqueId}.${fileExtension}`
        : `${uniqueId}.${fileExtension}`;

      // Upload to S3
      const result = await s3Service.putObject(
        bucket,
        key,
        file.data,
        {
          contentType: file.mimetype,
          contentLength: file.size,
          metadata
        }
      );

      return reply.code(200).send({
        success: true,
        location: result.location,
        bucket: result.bucket,
        key: result.key,
        size: file.size,
        contentType: file.mimetype
      });
    } catch (error) {
      console.error('Upload file error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  }

  /**
   * Download a file from S3
   * GET /api/v1/s3/objects/:bucket/:key
   */
  async downloadFile(
    request: FastifyRequest<{
      Params: { bucket: string; key: string };
      Querystring: { inline?: boolean };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, key } = request.params;
      const { inline = false } = request.query;

      // Get object from S3
      const result = await s3Service.getObject(bucket, key);

      // Set response headers
      reply.header('Content-Type', result.contentType || 'application/octet-stream');
      if (result.contentLength) {
        reply.header('Content-Length', result.contentLength);
      }
      if (result.lastModified) {
        reply.header('Last-Modified', result.lastModified.toUTCString());
      }
      if (result.etag) {
        reply.header('ETag', result.etag);
      }

      // Set content disposition based on inline parameter
      const filename = key.split('/').pop() || 'download';
      const disposition = inline ? 'inline' : 'attachment';
      reply.header('Content-Disposition', `${disposition}; filename="${filename}"`);

      // Stream the file
      if (result.body instanceof Readable) {
        return reply.send(result.body);
      } else {
        return reply.send(result.body);
      }
    } catch (error) {
      console.error('Download file error:', error);
      return reply.code(404).send({
        success: false,
        error: error instanceof Error ? error.message : 'File not found'
      });
    }
  }

  /**
   * Delete a file from S3
   * DELETE /api/v1/s3/objects/:bucket/:key
   */
  async deleteFile(
    request: FastifyRequest<{ Params: { bucket: string; key: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, key } = request.params;

      await s3Service.deleteObject(bucket, key);

      return reply.code(200).send({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      console.error('Delete file error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      });
    }
  }

  /**
   * Delete multiple files from S3
   * POST /api/v1/s3/objects/delete-batch
   */
  async deleteFiles(
    request: FastifyRequest<{ Body: DeleteObjectsRequest }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, keys } = request.body;

      if (!keys || keys.length === 0) {
        throw new InvalidRequestError('No keys provided');
      }

      const result = await s3Service.deleteObjects(bucket, keys);

      return reply.code(200).send({
        success: true,
        deleted: result.deleted,
        errors: result.errors
      });
    } catch (error) {
      console.error('Delete files error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      });
    }
  }

  /**
   * Check if file exists (HEAD request)
   * HEAD /api/v1/s3/objects/:bucket/:key
   */
  async headFile(
    request: FastifyRequest<{ Params: { bucket: string; key: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, key } = request.params;

      const result = await s3Service.headObject(bucket, key);

      if (!result.exists) {
        return reply.code(404).send();
      }

      // Set response headers
      if (result.contentType) {
        reply.header('Content-Type', result.contentType);
      }
      if (result.contentLength) {
        reply.header('Content-Length', result.contentLength);
      }
      if (result.lastModified) {
        reply.header('Last-Modified', result.lastModified.toUTCString());
      }
      if (result.etag) {
        reply.header('ETag', result.etag);
      }

      return reply.code(200).send();
    } catch (error) {
      console.error('Head file error:', error);
      return reply.code(404).send();
    }
  }

  /**
   * List objects in a bucket
   * GET /api/v1/s3/objects
   */
  async listObjects(
    request: FastifyRequest<{ Querystring: ListObjectsRequest }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, prefix, delimiter, maxKeys, continuationToken } = request.query;

      if (!bucket) {
        throw new InvalidRequestError('Bucket is required');
      }

      const result = await s3Service.listObjects(bucket, {
        prefix,
        delimiter,
        maxKeys,
        continuationToken
      });

      return reply.code(200).send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('List objects error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'List failed'
      });
    }
  }

  /**
   * Create a new bucket
   * POST /api/v1/s3/buckets
   */
  async createBucket(
    request: FastifyRequest<{ Body: { name: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { name } = request.body;

      if (!name) {
        throw new InvalidRequestError('Bucket name is required');
      }

      await s3Service.createBucket(name);

      return reply.code(201).send({
        success: true,
        message: `Bucket '${name}' created successfully`
      });
    } catch (error) {
      console.error('Create bucket error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Create failed'
      });
    }
  }

  /**
   * List all buckets
   * GET /api/v1/s3/buckets
   */
  async listBuckets(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await s3Service.listBuckets();

      return reply.code(200).send({
        success: true,
        buckets: result.buckets
      });
    } catch (error) {
      console.error('List buckets error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'List failed'
      });
    }
  }

  /**
   * Delete a bucket
   * DELETE /api/v1/s3/buckets/:name
   */
  async deleteBucket(
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { name } = request.params;

      await s3Service.deleteBucket(name);

      return reply.code(200).send({
        success: true,
        message: `Bucket '${name}' deleted successfully`
      });
    } catch (error) {
      console.error('Delete bucket error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      });
    }
  }

  /**
   * Generate presigned URL for temporary access
   * POST /api/v1/s3/presigned-url
   */
  async generatePresignedUrl(
    request: FastifyRequest<{ Body: PresignedUrlRequest }>,
    reply: FastifyReply
  ) {
    try {
      const { operation, bucket, key, expiresIn = S3_CONSTANTS.DEFAULT_EXPIRY } = request.body;

      // Validate expiry time
      if (expiresIn > S3_CONSTANTS.MAX_EXPIRY) {
        throw new InvalidRequestError(`Expiry time cannot exceed ${S3_CONSTANTS.MAX_EXPIRY} seconds`);
      }

      const url = await s3Service.generatePresignedUrl(
        operation === 'put' ? 'putObject' : 'getObject',
        bucket,
        key,
        expiresIn
      );

      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return reply.code(200).send({
        success: true,
        url,
        expiresAt
      });
    } catch (error) {
      console.error('Generate presigned URL error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate URL'
      });
    }
  }

  /**
   * Initialize multipart upload
   * POST /api/v1/s3/multipart/start
   */
  async startMultipartUpload(
    request: FastifyRequest<{
      Body: {
        bucket: string;
        key: string;
        contentType?: string;
        metadata?: Record<string, string>;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, key, contentType, metadata } = request.body;

      const result = await s3Service.createMultipartUpload(bucket, key, {
        contentType,
        metadata
      });

      return reply.code(200).send({
        success: true,
        uploadId: result.uploadId,
        bucket: result.bucket,
        key: result.key
      });
    } catch (error) {
      console.error('Start multipart upload error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start upload'
      });
    }
  }

  /**
   * Upload a part in multipart upload
   * POST /api/v1/s3/multipart/part
   */
  async uploadPart(
    request: FastifyRequest<{
      Body: {
        bucket: string;
        key: string;
        uploadId: string;
        partNumber: number;
        data: Buffer;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, key, uploadId, partNumber, data } = request.body;

      const result = await s3Service.uploadPart(bucket, key, uploadId, partNumber, data);

      return reply.code(200).send({
        success: true,
        etag: result.etag,
        partNumber: result.partNumber
      });
    } catch (error) {
      console.error('Upload part error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload part'
      });
    }
  }

  /**
   * Complete multipart upload
   * POST /api/v1/s3/multipart/complete
   */
  async completeMultipartUpload(
    request: FastifyRequest<{
      Body: {
        bucket: string;
        key: string;
        uploadId: string;
        parts: Array<{ etag: string; partNumber: number }>;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, key, uploadId, parts } = request.body;

      const result = await s3Service.completeMultipartUpload(bucket, key, uploadId, parts);

      return reply.code(200).send({
        success: true,
        location: result.location,
        bucket: result.bucket,
        key: result.key,
        etag: result.etag
      });
    } catch (error) {
      console.error('Complete multipart upload error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete upload'
      });
    }
  }

  /**
   * Abort multipart upload
   * DELETE /api/v1/s3/multipart/abort
   */
  async abortMultipartUpload(
    request: FastifyRequest<{
      Body: {
        bucket: string;
        key: string;
        uploadId: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { bucket, key, uploadId } = request.body;

      await s3Service.abortMultipartUpload(bucket, key, uploadId);

      return reply.code(200).send({
        success: true,
        message: 'Upload aborted successfully'
      });
    } catch (error) {
      console.error('Abort multipart upload error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to abort upload'
      });
    }
  }

  /**
   * Copy object from one location to another
   * POST /api/v1/s3/objects/copy
   */
  async copyObject(
    request: FastifyRequest<{
      Body: {
        sourceBucket: string;
        sourceKey: string;
        destBucket: string;
        destKey: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { sourceBucket, sourceKey, destBucket, destKey } = request.body;

      await s3Service.copyObject(sourceBucket, sourceKey, destBucket, destKey);

      return reply.code(200).send({
        success: true,
        message: 'Object copied successfully'
      });
    } catch (error) {
      console.error('Copy object error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Copy failed'
      });
    }
  }
}

// Export singleton instance
export const s3Controller = new S3Controller();