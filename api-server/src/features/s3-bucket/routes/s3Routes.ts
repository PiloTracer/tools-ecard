/**
 * S3 Routes Definition for Fastify
 *
 * This module defines all the API routes for S3 storage operations.
 */

import { FastifyInstance } from 'fastify';
import { s3Controller } from '../controllers/s3Controller';

// ============================================================================
// JSON Schema Definitions for Fastify Validation
// ============================================================================

const uploadFileSchema = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'object',
      required: ['data', 'filename', 'mimetype', 'size'],
      properties: {
        data: { type: 'object' }, // Buffer
        filename: { type: 'string' },
        mimetype: { type: 'string' },
        size: { type: 'number' }
      }
    },
    bucket: { type: 'string' },
    prefix: { type: 'string' },
    metadata: {
      type: 'object',
      additionalProperties: { type: 'string' }
    }
  }
};

const downloadFileParamsSchema = {
  type: 'object',
  required: ['bucket', 'key'],
  properties: {
    bucket: { type: 'string' },
    key: { type: 'string' }
  }
};

const downloadFileQuerySchema = {
  type: 'object',
  properties: {
    inline: { type: 'boolean' }
  }
};

const deleteFileParamsSchema = {
  type: 'object',
  required: ['bucket', 'key'],
  properties: {
    bucket: { type: 'string' },
    key: { type: 'string' }
  }
};

const deleteFilesSchema = {
  type: 'object',
  required: ['bucket', 'keys'],
  properties: {
    bucket: { type: 'string' },
    keys: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' }
    }
  }
};

const listObjectsSchema = {
  type: 'object',
  required: ['bucket'],
  properties: {
    bucket: { type: 'string' },
    prefix: { type: 'string' },
    delimiter: { type: 'string' },
    maxKeys: { type: 'number' },
    continuationToken: { type: 'string' }
  }
};

const createBucketSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' }
  }
};

const deleteBucketParamsSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' }
  }
};

const presignedUrlSchema = {
  type: 'object',
  required: ['operation', 'bucket', 'key'],
  properties: {
    operation: {
      type: 'string',
      enum: ['get', 'put']
    },
    bucket: { type: 'string' },
    key: { type: 'string' },
    expiresIn: { type: 'number' },
    contentType: { type: 'string' }
  }
};

const startMultipartSchema = {
  type: 'object',
  required: ['bucket', 'key'],
  properties: {
    bucket: { type: 'string' },
    key: { type: 'string' },
    contentType: { type: 'string' },
    metadata: {
      type: 'object',
      additionalProperties: { type: 'string' }
    }
  }
};

const uploadPartSchema = {
  type: 'object',
  required: ['bucket', 'key', 'uploadId', 'partNumber', 'data'],
  properties: {
    bucket: { type: 'string' },
    key: { type: 'string' },
    uploadId: { type: 'string' },
    partNumber: {
      type: 'number',
      minimum: 1
    },
    data: { type: 'object' } // Buffer
  }
};

const completeMultipartSchema = {
  type: 'object',
  required: ['bucket', 'key', 'uploadId', 'parts'],
  properties: {
    bucket: { type: 'string' },
    key: { type: 'string' },
    uploadId: { type: 'string' },
    parts: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['etag', 'partNumber'],
        properties: {
          etag: { type: 'string' },
          partNumber: { type: 'number' }
        }
      }
    }
  }
};

const abortMultipartSchema = {
  type: 'object',
  required: ['bucket', 'key', 'uploadId'],
  properties: {
    bucket: { type: 'string' },
    key: { type: 'string' },
    uploadId: { type: 'string' }
  }
};

const copyObjectSchema = {
  type: 'object',
  required: ['sourceBucket', 'sourceKey', 'destBucket', 'destKey'],
  properties: {
    sourceBucket: { type: 'string' },
    sourceKey: { type: 'string' },
    destBucket: { type: 'string' },
    destKey: { type: 'string' }
  }
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
      body: uploadFileSchema
    },
    handler: s3Controller.uploadFile.bind(s3Controller)
  });

  // Download file
  fastify.get('/api/v1/s3/objects/:bucket/:key(.*)', {
    schema: {
      description: 'Download a file from S3',
      tags: ['S3', 'Storage'],
      params: downloadFileParamsSchema,
      querystring: downloadFileQuerySchema
    },
    handler: s3Controller.downloadFile.bind(s3Controller)
  });

  // Check file exists (HEAD)
  fastify.head('/api/v1/s3/objects/:bucket/:key(.*)', {
    schema: {
      description: 'Check if a file exists in S3',
      tags: ['S3', 'Storage'],
      params: deleteFileParamsSchema
    },
    handler: s3Controller.headFile.bind(s3Controller)
  });

  // Delete file
  fastify.delete('/api/v1/s3/objects/:bucket/:key(.*)', {
    schema: {
      description: 'Delete a file from S3',
      tags: ['S3', 'Storage'],
      params: deleteFileParamsSchema
    },
    handler: s3Controller.deleteFile.bind(s3Controller)
  });

  // Delete multiple files
  fastify.post('/api/v1/s3/objects/delete-batch', {
    schema: {
      description: 'Delete multiple files from S3',
      tags: ['S3', 'Storage'],
      body: deleteFilesSchema
    },
    handler: s3Controller.deleteFiles.bind(s3Controller)
  });

  // List objects
  fastify.get('/api/v1/s3/objects', {
    schema: {
      description: 'List objects in an S3 bucket',
      tags: ['S3', 'Storage'],
      querystring: listObjectsSchema
    },
    handler: s3Controller.listObjects.bind(s3Controller)
  });

  // Copy object
  fastify.post('/api/v1/s3/objects/copy', {
    schema: {
      description: 'Copy an object from one location to another',
      tags: ['S3', 'Storage'],
      body: copyObjectSchema
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
      body: createBucketSchema
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
      params: deleteBucketParamsSchema
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
      body: presignedUrlSchema
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
      body: startMultipartSchema
    },
    handler: s3Controller.startMultipartUpload.bind(s3Controller)
  });

  // Upload part
  fastify.post('/api/v1/s3/multipart/part', {
    schema: {
      description: 'Upload a part in multipart upload',
      tags: ['S3', 'Storage', 'Multipart'],
      body: uploadPartSchema
    },
    handler: s3Controller.uploadPart.bind(s3Controller)
  });

  // Complete multipart upload
  fastify.post('/api/v1/s3/multipart/complete', {
    schema: {
      description: 'Complete a multipart upload',
      tags: ['S3', 'Storage', 'Multipart'],
      body: completeMultipartSchema
    },
    handler: s3Controller.completeMultipartUpload.bind(s3Controller)
  });

  // Abort multipart upload
  fastify.delete('/api/v1/s3/multipart/abort', {
    schema: {
      description: 'Abort a multipart upload',
      tags: ['S3', 'Storage', 'Multipart'],
      body: abortMultipartSchema
    },
    handler: s3Controller.abortMultipartUpload.bind(s3Controller)
  });

  console.log('S3 routes registered successfully');
}