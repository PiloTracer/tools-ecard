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
  const data =
    (raw.data as {
      cols?: string[];
      fields?: Partial<ContactRecord>;
    }) || {};
  const fields = data.fields || {};
  const cols = data.cols || [];
  const base = emptyContact(batchId, String(raw.id ?? ''));

  // Legacy rows (uploaded before the header-aware demo parser existed)
  // stored bare `cols` in a fixed [fullName, firstName, lastName, email]
  // order with no `fields` object at all. Once a row HAS structured
  // `fields` (every row uploaded via the current parser), a missing key
  // means "the sheet had no such column" — it must NOT fall back to
  // `cols[N]`, because `cols` now holds the sheet's actual, arbitrary
  // column order (e.g. cols[1] could be an email or phone column). Doing
  // so silently stuffed the wrong spreadsheet column into firstName /
  // lastName / email whenever a sheet had a single combined "full name"
  // column and no separate first/last columns — a very common layout.
  const hasStructuredFields = data.fields != null;
  const legacyCol = (i: number) => (hasStructuredFields ? null : cols[i] ?? null);

  return {
    ...base,
    fullName: fields.fullName ?? legacyCol(0),
    firstName: fields.firstName ?? legacyCol(1),
    lastName: fields.lastName ?? legacyCol(2),
    email: fields.email ?? legacyCol(3),
    workPhone: fields.workPhone ?? null,
    workPhoneExt: fields.workPhoneExt ?? null,
    mobilePhone: fields.mobilePhone ?? null,
    addressStreet: fields.addressStreet ?? null,
    addressCity: fields.addressCity ?? null,
    addressState: fields.addressState ?? null,
    addressPostal: fields.addressPostal ?? null,
    addressCountry: fields.addressCountry ?? null,
    businessName: fields.businessName ?? null,
    businessTitle: fields.businessTitle ?? null,
    businessDepartment: fields.businessDepartment ?? null,
    businessUrl: fields.businessUrl ?? null,
    personalBio: fields.personalBio ?? null,
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
      // Keep only contact fields (drop IDs/timestamps), and merge into the
      // existing data.fields rather than overwriting it with just 4 columns.
      // The previous version replaced `data` wholesale with a bare
      // `cols: [fullName, firstName, lastName, email]`, which silently
      // dropped every other field (business/address/social/etc.) and the
      // original `headers`/`cols` the moment a record was edited — those
      // fields would then read back as null on every subsequent load/export.
      const { batchRecordId: _id, batchId: _batchId, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = mapped;
      const prevData = (records[idx].data as { headers?: string[]; cols?: string[] }) || {};
      records[idx] = {
        ...records[idx],
        data: {
          ...prevData,
          fields,
        },
        updatedAt: new Date().toISOString(),
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
