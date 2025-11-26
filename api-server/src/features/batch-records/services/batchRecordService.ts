/**
 * Batch Record Service
 * Business logic for viewing and editing batch records
 */

import { batchRecordRepository, ContactRecordFull } from '../../batch-parsing/repositories/batchRecordRepository';
import { RecordValidator, RecordUpdateInput } from '../validators/recordValidator';
import { prisma } from '../../../core/database/prisma';

export class BatchRecordService {
  /**
   * Get all records for a batch with full vCard data
   */
  async getRecordsForBatch(
    batchId: string,
    userId: string,
    options: { page?: number; pageSize?: number; search?: string } = {}
  ) {
    const { page = 1, pageSize = 50, search } = options;

    // Validate pagination
    if (pageSize > 500) {
      throw new Error('Page size cannot exceed 500');
    }

    const offset = (page - 1) * pageSize;

    // Get full records with Cassandra data
    const { records, total } = await batchRecordRepository.getFullRecordsForBatch(
      batchId,
      userId,
      pageSize,
      offset
    );

    // Apply client-side search if provided
    let filteredRecords = records;
    if (search) {
      filteredRecords = this.searchRecords(records, search);
    }

    // Get batch metadata
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, userId },
    });

    return {
      batchId,
      batchFileName: batch?.fileName || '',
      batchStatus: batch?.status || 'UNKNOWN',
      records: filteredRecords,
      pagination: {
        total: search ? filteredRecords.length : total,
        page,
        pageSize,
        totalPages: Math.ceil((search ? filteredRecords.length : total) / pageSize),
      },
    };
  }

  /**
   * Get single record by ID
   */
  async getRecordById(recordId: string, userId: string): Promise<ContactRecordFull> {
    // Verify ownership
    const record = await prisma.batchRecord.findUnique({
      where: { id: recordId },
      include: { batch: true },
    });

    if (!record || record.batch.userId !== userId) {
      throw new Error('Record not found or access denied');
    }

    const fullRecord = await batchRecordRepository.getFullContactRecord(recordId);
    if (!fullRecord) {
      throw new Error('Record not found');
    }

    return fullRecord;
  }

  /**
   * Update a record
   */
  async updateRecord(
    recordId: string,
    updates: RecordUpdateInput,
    userId: string
  ): Promise<ContactRecordFull> {
    // Validate input
    const validation = RecordValidator.validateUpdateInput(updates);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Perform update in both databases
    return await batchRecordRepository.updateRecord(recordId, updates, userId);
  }

  /**
   * Delete a record
   */
  async deleteRecord(recordId: string, userId: string): Promise<void> {
    await batchRecordRepository.deleteRecord(recordId, userId);
  }

  /**
   * Client-side full-text search across all fields
   */
  private searchRecords(records: ContactRecordFull[], query: string): ContactRecordFull[] {
    const lowerQuery = query.toLowerCase();

    return records.filter((record) => {
      // Build searchable text from all fields
      const searchableText = [
        record.fullName,
        record.firstName,
        record.lastName,
        record.email,
        record.workPhone,
        record.workPhoneExt,
        record.mobilePhone,
        record.addressStreet,
        record.addressCity,
        record.addressState,
        record.addressPostal,
        record.addressCountry,
        record.socialInstagram,
        record.socialTwitter,
        record.socialFacebook,
        record.businessName,
        record.businessTitle,
        record.businessDepartment,
        record.businessUrl,
        record.businessHours,
        record.businessAddressStreet,
        record.businessAddressCity,
        record.businessAddressState,
        record.businessAddressPostal,
        record.businessAddressCountry,
        record.businessLinkedin,
        record.businessTwitter,
        record.personalUrl,
        record.personalBio,
        record.personalBirthday,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(lowerQuery);
    });
  }
}

// Export singleton instance
export const batchRecordService = new BatchRecordService();
