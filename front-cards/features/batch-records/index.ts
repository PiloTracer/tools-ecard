/**
 * Batch Records Feature - Public Exports
 */

// Components
export { RecordsList } from './components/RecordsList';
export { RecordCard } from './components/RecordCard';
export { RecordSearch } from './components/RecordSearch';
export { RecordEditModal } from './components/RecordEditModal';

// Hooks
export { useRecords } from './hooks/useRecords';
export { useRecordEdit } from './hooks/useRecordEdit';
export { useRecordDelete } from './hooks/useRecordDelete';

// Services
export { batchRecordService } from './services/batchRecordService';

// Utils
export { searchRecords } from './utils/recordSearcher';

// Types
export type {
  ContactRecord,
  RecordsListResponse,
  RecordResponse,
  UpdateRecordResponse,
  DeleteRecordResponse,
  RecordUpdateInput,
} from './types';
