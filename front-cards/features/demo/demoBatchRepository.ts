/**
 * Demo batch repository — localStorage; render status mocked
 */

import {
  BatchStatus,
  type Batch,
  type BatchStats,
  type BatchUploadResponse,
  type BatchStatusResponse,
  type ListBatchesResponse,
} from '@/features/batch-upload/types';
import { demoStore, newDemoId } from './demoStore';
import {
  isUsefulDemoContactRow,
  mapRowToContactFields,
  parseDemoSpreadsheetFile,
} from './demoSpreadsheetParser';

interface DemoBatchRecord {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  fileSize: number;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  totalRecords: number;
  processedRecords: number;
}

function toBatch(b: DemoBatchRecord): Batch {
  return {
    id: b.id,
    fileName: b.fileName,
    fileSize: b.fileSize,
    status: b.status,
    createdAt: new Date(b.createdAt),
    updatedAt: new Date(b.updatedAt),
    progress: 100,
  };
}

export const demoBatchRepository = {
  async uploadBatch(file: File, projectId: string, projectName: string): Promise<BatchUploadResponse> {
    const id = newDemoId('batch');
    const now = new Date().toISOString();
    const table = await parseDemoSpreadsheetFile(file);
    const dataRows = table.rows.filter((cols) =>
      isUsefulDemoContactRow(table.headers, cols)
    );
    const totalRecords = dataRows.length;

    const records = dataRows.map((cols, i) => {
      const fields = mapRowToContactFields(table.headers, cols);
      return {
        id: newDemoId('rec'),
        batchId: id,
        rowIndex: i,
        data: {
          headers: table.headers,
          cols,
          fields,
        },
        status: 'completed',
        renderStatus: 'completed',
        renderProgress: 100,
        projectId,
        projectName,
      };
    });

    const batch: DemoBatchRecord = {
      id,
      projectId,
      projectName,
      fileName: file.name,
      fileSize: file.size,
      status: BatchStatus.LOADED,
      createdAt: now,
      updatedAt: now,
      totalRecords,
      processedRecords: totalRecords,
    };

    const batches = demoStore.getBatches<DemoBatchRecord>();
    batches.unshift(batch);
    demoStore.setBatches(batches);
    demoStore.setBatchRecords(id, records);

    return {
      id,
      status: BatchStatus.LOADED,
      message: 'Demo batch stored in browser only (render mocked)',
    };
  },

  async getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
    const batch = demoStore.getBatches<DemoBatchRecord>().find((b) => b.id === batchId);
    if (!batch) throw new Error('Demo batch not found');
    return {
      id: batch.id,
      status: batch.status,
      progress: 100,
      fileName: batch.fileName,
      fileSize: batch.fileSize,
      createdAt: new Date(batch.createdAt),
      updatedAt: new Date(batch.updatedAt),
    };
  },

  async listBatches(params?: {
    status?: BatchStatus;
    page?: number;
    limit?: number;
  }): Promise<ListBatchesResponse> {
    let batches = demoStore.getBatches<DemoBatchRecord>();
    if (params?.status) {
      batches = batches.filter((b) => b.status === params.status);
    }
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const start = (page - 1) * limit;
    const slice = batches.slice(start, start + limit);
    return {
      batches: slice.map(toBatch),
      total: batches.length,
      page,
      limit,
    };
  },

  async deleteBatch(batchId: string): Promise<void> {
    demoStore.setBatches(demoStore.getBatches<DemoBatchRecord>().filter((b) => b.id !== batchId));
    demoStore.setBatchRecords(batchId, []);
  },

  async retryBatch(batchId: string): Promise<BatchUploadResponse> {
    return {
      id: batchId,
      status: BatchStatus.LOADED,
      message: 'Demo retry is a no-op (already local)',
    };
  },

  async getBatchStats(): Promise<BatchStats> {
    const batches = demoStore.getBatches<DemoBatchRecord>();
    return {
      total: batches.length,
      uploaded: batches.filter((b) => b.status === BatchStatus.UPLOADED).length,
      parsing: batches.filter((b) => b.status === BatchStatus.PARSING).length,
      parsed: batches.filter((b) => b.status === BatchStatus.PARSED).length,
      loaded: batches.filter((b) => b.status === BatchStatus.LOADED).length,
      error: batches.filter((b) => b.status === BatchStatus.ERROR).length,
    };
  },

  async getRecentBatches(limit: number = 5): Promise<Batch[]> {
    return demoStore.getBatches<DemoBatchRecord>().slice(0, limit).map(toBatch);
  },

  getRecords(batchId: string) {
    return demoStore.getBatchRecords<Record<string, unknown>>(batchId);
  },

  setRecords(batchId: string, records: Record<string, unknown>[]) {
    demoStore.setBatchRecords(batchId, records);
  },
};
