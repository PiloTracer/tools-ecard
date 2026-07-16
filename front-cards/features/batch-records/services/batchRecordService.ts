/**
 * Batch Record API Service
 * Client-side API calls for record management
 */

import { apiClient } from '@/shared/lib/api-client';
import type {
  ContactRecord,
  RecordsListResponse,
  RecordResponse,
  UpdateRecordResponse,
  DeleteRecordResponse,
  RecordUpdateInput,
} from '../types';
import { isDemoMode } from '@/features/demo/isDemoMode';
import { demoBatchRepository } from '@/features/demo/demoBatchRepository';

function emptyContact(batchId: string, id: string): ContactRecord {
  return {
    batchRecordId: id,
    batchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fullName: null,
    firstName: null,
    lastName: null,
    workPhone: null,
    workPhoneExt: null,
    mobilePhone: null,
    email: null,
    addressStreet: null,
    addressCity: null,
    addressState: null,
    addressPostal: null,
    addressCountry: null,
    socialInstagram: null,
    socialTwitter: null,
    socialFacebook: null,
    businessName: null,
    businessTitle: null,
    businessDepartment: null,
    businessUrl: null,
    businessHours: null,
    businessAddressStreet: null,
    businessAddressCity: null,
    businessAddressState: null,
    businessAddressPostal: null,
    businessAddressCountry: null,
    businessLinkedin: null,
    businessTwitter: null,
    personalUrl: null,
    personalBio: null,
    personalBirthday: null,
    extra: null,
  };
}

function mapDemoRecord(raw: Record<string, unknown>, batchId: string): ContactRecord {
  const data = (raw.data as { cols?: string[] }) || {};
  const cols = data.cols || [];
  const base = emptyContact(batchId, String(raw.id ?? ''));
  return {
    ...base,
    fullName: cols[0] ?? null,
    firstName: cols[1] ?? null,
    lastName: cols[2] ?? null,
    email: cols[3] ?? null,
  };
}

export const batchRecordService = {
  async fetchRecordsForBatch(
    batchId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ): Promise<RecordsListResponse> {
    if (isDemoMode()) {
      const { page = 1, pageSize = 50, search } = options;
      let records = demoBatchRepository.getRecords(batchId).map((r) => mapDemoRecord(r, batchId));
      if (search) {
        const q = search.toLowerCase();
        records = records.filter(
          (r) =>
            (r.fullName || '').toLowerCase().includes(q) ||
            (r.email || '').toLowerCase().includes(q)
        );
      }
      const start = (page - 1) * pageSize;
      const slice = records.slice(start, start + pageSize);
      const status = await demoBatchRepository.getBatchStatus(batchId).catch(() => null);
      return {
        success: true,
        data: {
          batchId,
          batchFileName: status?.fileName ?? 'demo.csv',
          batchStatus: status?.status ?? 'LOADED',
          records: slice,
          pagination: {
            total: records.length,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(records.length / pageSize)),
          },
        },
      };
    }

    const { page = 1, pageSize = 50, search } = options;
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (search) {
      params.append('search', search);
    }

    return await apiClient.get<RecordsListResponse>(
      `/api/batches/${batchId}/records?${params.toString()}`
    );
  },

  async fetchRecord(batchId: string, recordId: string): Promise<RecordResponse> {
    if (isDemoMode()) {
      const raw = demoBatchRepository.getRecords(batchId).find((r) => r.id === recordId);
      if (!raw) throw new Error('Demo record not found');
      return { success: true, data: mapDemoRecord(raw, batchId) };
    }
    return await apiClient.get<RecordResponse>(`/api/batches/${batchId}/records/${recordId}`);
  },

  async updateRecord(
    batchId: string,
    recordId: string,
    updates: RecordUpdateInput
  ): Promise<UpdateRecordResponse> {
    if (isDemoMode()) {
      const records = demoBatchRepository.getRecords(batchId);
      const idx = records.findIndex((r) => r.id === recordId);
      if (idx < 0) throw new Error('Demo record not found');
      const mapped = { ...mapDemoRecord(records[idx], batchId), ...updates };
      records[idx] = {
        ...records[idx],
        data: {
          cols: [mapped.fullName, mapped.firstName, mapped.lastName, mapped.email].map((v) =>
            v == null ? '' : String(v)
          ),
        },
      };
      demoBatchRepository.setRecords(batchId, records);
      return { success: true, data: mapped, message: 'Demo record updated' };
    }
    return await apiClient.put<UpdateRecordResponse>(
      `/api/batches/${batchId}/records/${recordId}`,
      updates
    );
  },

  async deleteRecord(batchId: string, recordId: string): Promise<DeleteRecordResponse> {
    if (isDemoMode()) {
      const records = demoBatchRepository.getRecords(batchId).filter((r) => r.id !== recordId);
      demoBatchRepository.setRecords(batchId, records);
      return { success: true, message: 'Demo record deleted' };
    }
    return await apiClient.delete<DeleteRecordResponse>(`/api/batches/${batchId}/records/${recordId}`);
  },
};
