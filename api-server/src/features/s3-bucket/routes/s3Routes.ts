/**
 * S3 Routes Definition for Fastify
 *
 * This module defines all the API routes for S3 storage operations.
 */

import { FastifyInstance } from 'fastify';
import { s3Controller } from '../controllers/s3Controller';
import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

const uploadFileSchema = {
  body: z.object({
    file: z.object({
      data: z.any(), // Buffer
      filename: z.string(),
      mimetype: z.string(),
      size: z.number()
    }),
    bucket: z.string().optional(),
    prefix: z.string().optional(),
    metadata: z.record(z.string()).optional()
  })
};

const downloadFileSchema = {
  params: z.object({
    bucket: z.string(),
    key: z.string()
  }),
  querystring: z.object({
    inline: z.boolean().optional()
  })
};

const deleteFileSchema = {
  params: z.object({
    bucket: z.string(),
    key: z.string()
  })
};

const deleteFilesSchema = {
  body: z.object({
    bucket: z.string(),
    keys: z.array(z.string()).min(1)
  })
};

const listObjectsSchema = {
  querystring: z.object({
    bucket: z.string(),
    prefix: z.string().optional(),
    delimiter: z.string().optional(),
    maxKeys: z.number().optional(),
    continuationToken: z.string().optional()
  })
};

const createBucketSchema = {
  body: z.object({
    name: z.string()
  })
};

const deleteBucketSchema = {
  params: z.object({
    name: z.string()
  })
};

const presignedUrlSchema = {
  body: z.object({
    operation: z.enum(['get', 'put']),
    bucket: z.string(),
    key: z.string(),
    expiresIn: z.number().optional(),
    contentType: z.string().optional()
  })
};

const startMultipartSchema = {
  body: z.object({
    bucket: z.string(),
    key: z.string(),
    contentType: z.string().optional(),
    metadata: z.record(z.string()).optional()
  })
};

const uploadPartSchema = {
  body: z.object({
    bucket: z.string(),
    key: z.string(),
    uploadId: z.string(),
    partNumber: z.number().min(1),
    data: z.any() // Buffer
  })
};

const completeMultipartSchema = {
  body: z.object({
    bucket: z.string(),
    key: z.string(),
    uploadId: z.string(),
    parts: z.array(z.object({
      etag: z.string(),
      partNumber: z.number()
    })).min(1)
  })
};

const abortMultipartSchema = {
  body: z.object({
    bucket: z.string(),
    key: z.string(),
    uploadId: z.string()
  })
};

const copyObjectSchema = {
  body: z.object({
    sourceBucket: z.string(),
    sourceKey: z.string(),
    destBucket: z.string(),
    destKey: z.string()
  })
};

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register S3 routes with Fastify
 */
export async function s3Routes(fastify: FastifyInstance) {
  // ============================================================================
  // Object Operations
  // ============================================================================

  // Upload file
  fastify.post('/api/v1/s3/objects', {
    schema: {
      description: 'Upload a file to S3',
      tags: ['S3', 'Storage'],
      body: uploadFileSchema.body
    },
    handler: s3Controller.uploadFile.bind(s3Controller)
  });

  // Download file
  fastify.get('/api/v1/s3/objects/:bucket/:key(*)', {
    schema: {
      description: 'Download a file from S3',
      tags: ['S3', 'Storage'],
      params: downloadFileSchema.params,
      querystring: downloadFileSchema.querystring
    },
    handler: s3Controller.downloadFile.bind(s3Controller)
  });

  // Check file exists (HEAD)
  fastify.head('/api/v1/s3/objects/:bucket/:key(*)', {
    schema: {
      description: 'Check if a file exists in S3',
      tags: ['S3', 'Storage'],
      params: deleteFileSchema.params
    },
    handler: s3Controller.headFile.bind(s3Controller)
  });

  // Delete file
  fastify.delete('/api/v1/s3/objects/:bucket/:key(*)', {
    schema: {
      description: 'Delete a file from S3',
      tags: ['S3', 'Storage'],
      params: deleteFileSchema.params
    },
    handler: s3Controller.deleteFile.bind(s3Controller)
  });

  // Delete multiple files
  fastify.post('/api/v1/s3/objects/delete-batch', {
    schema: {
      description: 'Delete multiple files from S3',
      tags: ['S3', 'Storage'],
      body: deleteFilesSchema.body
    },
    handler: s3Controller.deleteFiles.bind(s3Controller)
  });

  // List objects
  fastify.get('/api/v1/s3/objects', {
    schema: {
      description: 'List objects in an S3 bucket',
      tags: ['S3', 'Storage'],
      querystring: listObjectsSchema.querystring
    },
    handler: s3Controller.listObjects.bind(s3Controller)
  });

  // Copy object
  fastify.post('/api/v1/s3/objects/copy', {
    schema: {
      description: 'Copy an object from one location to another',
      tags: ['S3', 'Storage'],
      body: copyObjectSchema.body
    },
    handler: s3Controller.copyObject.bind(s3Controller)
  });

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  // Create bucket
  fastify.post('/api/v1/s3/buckets', {
    schema: {
      description: 'Create a new S3 bucket',
      tags: ['S3', 'Storage'],
      body: createBucketSchema.body
    },
    handler: s3Controller.createBucket.bind(s3Controller)
  });

  // List buckets
  fastify.get('/api/v1/s3/buckets', {
    schema: {
      description: 'List all S3 buckets',
      tags: ['S3', 'Storage']
    },
    handler: s3Controller.listBuckets.bind(s3Controller)
  });

  // Delete bucket
  fastify.delete('/api/v1/s3/buckets/:name', {
    schema: {
      description: 'Delete an S3 bucket',
      tags: ['S3', 'Storage'],
      params: deleteBucketSchema.params
    },
    handler: s3Controller.deleteBucket.bind(s3Controller)
  });

  // ============================================================================
  // Presigned URL Operations
  // ============================================================================

  // Generate presigned URL
  fastify.post('/api/v1/s3/presigned-url', {
    schema: {
      description: 'Generate a presigned URL for temporary access',
      tags: ['S3', 'Storage'],
      body: presignedUrlSchema.body
    },
    handler: s3Controller.generatePresignedUrl.bind(s3Controller)
  });

  // ============================================================================
  // Multipart Upload Operations
  // ============================================================================

  // Start multipart upload
  fastify.post('/api/v1/s3/multipart/start', {
    schema: {
      description: 'Initialize a multipart upload',
      tags: ['S3', 'Storage', 'Multipart'],
      body: startMultipartSchema.body
    },
    handler: s3Controller.startMultipartUpload.bind(s3Controller)
  });

  // Upload part
  fastify.post('/api/v1/s3/multipart/part', {
    schema: {
      description: 'Upload a part in multipart upload',
      tags: ['S3', 'Storage', 'Multipart'],
      body: uploadPartSchema.body
    },
    handler: s3Controller.uploadPart.bind(s3Controller)
  });

  // Complete multipart upload
  fastify.post('/api/v1/s3/multipart/complete', {
    schema: {
      description: 'Complete a multipart upload',
      tags: ['S3', 'Storage', 'Multipart'],
      body: completeMultipartSchema.body
    },
    handler: s3Controller.completeMultipartUpload.bind(s3Controller)
  });

  // Abort multipart upload
  fastify.delete('/api/v1/s3/multipart/abort', {
    schema: {
      description: 'Abort a multipart upload',
      tags: ['S3', 'Storage', 'Multipart'],
      body: abortMultipartSchema.body
    },
    handler: s3Controller.abortMultipartUpload.bind(s3Controller)
  });

  console.log('S3 routes registered successfully');
}