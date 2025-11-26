/**
 * Batch Records Feature - Public Exports
 */

export { batchRecordService } from './services/batchRecordService';
export { batchRecordController } from './controllers/batchRecordController';
export { default as batchRecordRoutes } from './routes.fastify';
export { RecordValidator } from './validators/recordValidator';
export type { RecordUpdateInput } from './validators/recordValidator';
