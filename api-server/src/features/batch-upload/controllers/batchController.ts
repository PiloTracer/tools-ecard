import { Request, Response, NextFunction } from 'express';
import { batchUploadService } from '../services/batchUploadService';
import {
  uploadFileSchema,
  getBatchStatusSchema,
  listBatchesSchema,
  deleteBatchSchema,
} from '../validators/batchValidators';
import { BatchUploadError } from '../types';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const batchController = {
  // Upload a new batch file
  async uploadBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Validate user is authenticated
      if (!req.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      // Validate file
      if (!req.file) {
        throw new BatchUploadError(
          'No file provided',
          'NO_FILE',
          400
        );
      }

      const validation = uploadFileSchema.safeParse({ file: req.file });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      // Upload batch
      const result = await batchUploadService.uploadBatch({
        file: req.file,
        userId: req.user.id,
        userEmail: req.user.email,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  // Get batch status
  async getBatchStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Validate user is authenticated
      if (!req.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      // Validate request
      const validation = getBatchStatusSchema.safeParse({
        params: req.params,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      const result = await batchUploadService.getBatchStatus(
        req.user.id,
        req.params.id
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // List user's batches
  async listBatches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Validate user is authenticated
      if (!req.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      // Validate query parameters
      const validation = listBatchesSchema.safeParse({
        query: req.query,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      const query = validation.data.query || {};
      const result = await batchUploadService.listUserBatches(
        req.user.id,
        query
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // Delete a batch
  async deleteBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Validate user is authenticated
      if (!req.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      // Validate request
      const validation = deleteBatchSchema.safeParse({
        params: req.params,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      await batchUploadService.deleteBatch(req.user.id, req.params.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // Retry a failed batch
  async retryBatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Validate user is authenticated
      if (!req.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      // Validate request
      const validation = getBatchStatusSchema.safeParse({
        params: req.params,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      const result = await batchUploadService.retryBatch(
        req.user.id,
        req.params.id
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // Get batch statistics
  async getBatchStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Validate user is authenticated
      if (!req.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const stats = await batchUploadService.getBatchStats(req.user.id);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  },

  // Get recent batches
  async getRecentBatches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Validate user is authenticated
      if (!req.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const limit = parseInt(req.query.limit as string, 10) || 5;
      const batches = await batchUploadService.getRecentBatches(
        req.user.id,
        limit
      );

      res.json(batches);
    } catch (error) {
      next(error);
    }
  },
};