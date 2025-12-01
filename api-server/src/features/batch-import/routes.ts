import { Router } from 'express';
import { batchImportController } from './controllers/batchImportController';
import { authMiddleware } from '@/core/middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Batch Import Routes (Placeholder)
 *
 * These endpoints provide the structure for batch import functionality.
 * Currently return placeholder responses for API demonstration.
 *
 * Future implementation will include full parsing and import logic.
 */

// Import a batch file (initiate processing)
router.post('/:id/import', batchImportController.importBatch);

// Get import preview (sample of parsed records)
router.get('/:id/preview', batchImportController.getImportPreview);

// Get field mapping suggestions
router.get('/:id/mappings/suggest', batchImportController.getFieldMappingSuggestions);

// Validate import data
router.post('/:id/validate', batchImportController.validateImport);

// Get import status
router.get('/:id/status', batchImportController.getImportStatus);

// Cancel ongoing import
router.post('/:id/cancel', batchImportController.cancelImport);

export { router as batchImportRoutes };