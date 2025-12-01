import { Router } from 'express';
import multer from 'multer';
import { batchController } from './controllers/batchController';
import { authMiddleware } from '@/core/middleware/auth';
import { MAX_FILE_SIZE } from './types';

// Configure multer for file upload
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Additional file type validation will be done in the controller
    cb(null, true);
  },
});

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Upload a new batch file
router.post(
  '/upload',
  upload.single('file'),
  batchController.uploadBatch
);

// Get batch status
router.get('/:id/status', batchController.getBatchStatus);

// List user's batches
router.get('/', batchController.listBatches);

// Delete a batch
router.delete('/:id', batchController.deleteBatch);

// Retry a failed batch
router.post('/:id/retry', batchController.retryBatch);

// Get batch statistics
router.get('/stats', batchController.getBatchStats);

// Get recent batches
router.get('/recent', batchController.getRecentBatches);

export { router as batchUploadRoutes };