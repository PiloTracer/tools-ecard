/**
 * Batch Record Repository
 * Handles database operations for batch records (hybrid PostgreSQL + Cassandra)
 */

import { prisma } from '../../../core/database/prisma';
import { cassandraClient } from '../../../core/cassandra/client';
import { types as CassandraTypes } from 'cassandra-driver';

export interface BatchRecordSearchParams {
  email?: string;
  fullName?: string;
  businessName?: string;
  workPhone?: string;
  mobilePhone?: string;
  batchId?: string;
  limit?: number;
  offset?: number;
}

export interface BatchRecordSearchResult {
  id: string;
  batchId: string;
  fullName: string | null;
  workPhone: string | null;
  mobilePhone: string | null;
  email: string | null;
  businessName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactRecordFull {
  batchRecordId: string;
  batchId: string;
  createdAt: Date;
  updatedAt: Date;

  // All vCard fields
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  workPhone: string | null;
  workPhoneExt: string | null;
  mobilePhone: string | null;
  email: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostal: string | null;
  addressCountry: string | null;
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialFacebook: string | null;
  businessName: string | null;
  businessTitle: string | null;
  businessDepartment: string | null;
  businessUrl: string | null;
  businessHours: string | null;
  businessAddressStreet: string | null;
  businessAddressCity: string | null;
  businessAddressState: string | null;
  businessAddressPostal: string | null;
  businessAddressCountry: string | null;
  businessLinkedin: string | null;
  businessTwitter: string | null;
  personalUrl: string | null;
  personalBio: string | null;
  personalBirthday: string | null;
  extra: Record<string, string> | null;
}

export class BatchRecordRepository {
  /**
   * Search batch records using PostgreSQL (5 searchable fields)
   */
  async searchRecords(
    params: BatchRecordSearchParams
  ): Promise<{ records: BatchRecordSearchResult[]; total: number }> {
    const {
      email,
      fullName,
      businessName,
      workPhone,
      mobilePhone,
      batchId,
      limit = 50,
      offset = 0,
    } = params;

    // Build where clause
    const where: any = {};

    if (batchId) {
      where.batchId = batchId;
    }

    if (email) {
      where.email = {
        contains: email,
        mode: 'insensitive',
      };
    }

    if (fullName) {
      where.fullName = {
        contains: fullName,
        mode: 'insensitive',
      };
    }

    if (businessName) {
      where.businessName = {
        contains: businessName,
        mode: 'insensitive',
      };
    }

    if (workPhone) {
      where.workPhone = {
        contains: workPhone,
      };
    }

    if (mobilePhone) {
      where.mobilePhone = {
        contains: mobilePhone,
      };
    }

    // Execute query
    const [records, total] = await Promise.all([
      prisma.batchRecord.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.batchRecord.count({ where }),
    ]);

    return { records, total };
  }

  /**
   * Get full contact details from Cassandra by batch_record_id
   */
  async getFullContactRecord(batchRecordId: string): Promise<ContactRecordFull | null> {
    try {
      await cassandraClient.connect();

      const query = `
        SELECT * FROM contact_records
        WHERE batch_record_id = ?
      `;

      const result = await cassandraClient['client']!.execute(
        query,
        [CassandraTypes.Uuid.fromString(batchRecordId)],
        { prepare: true }
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        batchRecordId: row.batch_record_id?.toString() || '',
        batchId: row.batch_id?.toString() || '',
        createdAt: row.created_at || new Date(),
        updatedAt: row.updated_at || new Date(),

        fullName: row.full_name || null,
        firstName: row.first_name || null,
        lastName: row.last_name || null,
        workPhone: row.work_phone || null,
        workPhoneExt: row.work_phone_ext || null,
        mobilePhone: row.mobile_phone || null,
        email: row.email || null,
        addressStreet: row.address_street || null,
        addressCity: row.address_city || null,
        addressState: row.address_state || null,
        addressPostal: row.address_postal || null,
        addressCountry: row.address_country || null,
        socialInstagram: row.social_instagram || null,
        socialTwitter: row.social_twitter || null,
        socialFacebook: row.social_facebook || null,
        businessName: row.business_name || null,
        businessTitle: row.business_title || null,
        businessDepartment: row.business_department || null,
        businessUrl: row.business_url || null,
        businessHours: row.business_hours || null,
        businessAddressStreet: row.business_address_street || null,
        businessAddressCity: row.business_address_city || null,
        businessAddressState: row.business_address_state || null,
        businessAddressPostal: row.business_address_postal || null,
        businessAddressCountry: row.business_address_country || null,
        businessLinkedin: row.business_linkedin || null,
        businessTwitter: row.business_twitter || null,
        personalUrl: row.personal_url || null,
        personalBio: row.personal_bio || null,
        personalBirthday: row.personal_birthday || null,
        extra: row.extra || null,
      };
    } catch (error) {
      console.error('Error fetching full contact record:', error);
      throw error;
    }
  }

  /**
   * Get all records for a specific batch (PostgreSQL)
   */
  async getRecordsByBatchId(
    batchId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ records: BatchRecordSearchResult[]; total: number }> {
    return this.searchRecords({ batchId, limit, offset });
  }

  /**
   * Get record count by batch ID
   */
  async getRecordCountByBatchId(batchId: string): Promise<number> {
    return prisma.batchRecord.count({
      where: {
        batchId,
      },
    });
  }

  /**
   * Update record in both PostgreSQL and Cassandra
   * Syncs searchable fields to PostgreSQL and all fields to Cassandra
   */
  async updateRecord(
    recordId: string,
    updates: Partial<ContactRecordFull>,
    userId: string
  ): Promise<ContactRecordFull> {
    try {
      // 1. Verify ownership via batch
      const existingRecord = await prisma.batchRecord.findUnique({
        where: { id: recordId },
        include: { batch: true },
      });

      if (!existingRecord) {
        throw new Error('Record not found');
      }

      if (existingRecord.batch.userId !== userId) {
        throw new Error('Unauthorized: User does not own this record');
      }

      // 2. Extract searchable fields for PostgreSQL (5 fields only)
      const searchableUpdates: any = {};
      if (updates.fullName !== undefined) searchableUpdates.fullName = updates.fullName;
      if (updates.workPhone !== undefined) searchableUpdates.workPhone = updates.workPhone;
      if (updates.mobilePhone !== undefined) searchableUpdates.mobilePhone = updates.mobilePhone;
      if (updates.email !== undefined) searchableUpdates.email = updates.email;
      if (updates.businessName !== undefined) searchableUpdates.businessName = updates.businessName;

      // 3. Update PostgreSQL (searchable subset)
      const pgUpdatePromise = prisma.batchRecord.update({
        where: { id: recordId },
        data: searchableUpdates,
      });

      // 4. Update Cassandra (all fields)
      await cassandraClient.connect();

      // Build dynamic CQL UPDATE statement based on provided fields
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      const fieldMap: Record<string, string> = {
        fullName: 'full_name',
        firstName: 'first_name',
        lastName: 'last_name',
        workPhone: 'work_phone',
        workPhoneExt: 'work_phone_ext',
        mobilePhone: 'mobile_phone',
        email: 'email',
        addressStreet: 'address_street',
        addressCity: 'address_city',
        addressState: 'address_state',
        addressPostal: 'address_postal',
        addressCountry: 'address_country',
        socialInstagram: 'social_instagram',
        socialTwitter: 'social_twitter',
        socialFacebook: 'social_facebook',
        businessName: 'business_name',
        businessTitle: 'business_title',
        businessDepartment: 'business_department',
        businessUrl: 'business_url',
        businessHours: 'business_hours',
        businessAddressStreet: 'business_address_street',
        businessAddressCity: 'business_address_city',
        businessAddressState: 'business_address_state',
        businessAddressPostal: 'business_address_postal',
        businessAddressCountry: 'business_address_country',
        businessLinkedin: 'business_linkedin',
        businessTwitter: 'business_twitter',
        personalUrl: 'personal_url',
        personalBio: 'personal_bio',
        personalBirthday: 'personal_birthday',
      };

      // Add updated_at timestamp
      updateFields.push('updated_at = ?');
      updateValues.push(new Date());

      // Build update fields dynamically
      for (const [key, cassandraField] of Object.entries(fieldMap)) {
        if (updates[key as keyof ContactRecordFull] !== undefined) {
          updateFields.push(`${cassandraField} = ?`);
          updateValues.push(updates[key as keyof ContactRecordFull]);
        }
      }

      // Handle extra field if provided
      if (updates.extra !== undefined) {
        updateFields.push('extra = ?');
        updateValues.push(updates.extra);
      }

      // Add recordId for WHERE clause
      updateValues.push(CassandraTypes.Uuid.fromString(recordId));

      const cassandraUpdateQuery = `
        UPDATE contact_records
        SET ${updateFields.join(', ')}
        WHERE batch_record_id = ?
      `;

      const cassandraUpdatePromise = cassandraClient['client']!.execute(
        cassandraUpdateQuery,
        updateValues,
        { prepare: true }
      );

      // 5. Execute both updates in parallel
      await Promise.all([pgUpdatePromise, cassandraUpdatePromise]);

      // 6. Fetch and return updated record
      const updatedRecord = await this.getFullContactRecord(recordId);
      if (!updatedRecord) {
        throw new Error('Failed to retrieve updated record');
      }

      return updatedRecord;
    } catch (error) {
      console.error('Error updating record:', error);
      throw error;
    }
  }

  /**
   * Delete record from both PostgreSQL and Cassandra
   */
  async deleteRecord(recordId: string, userId: string): Promise<void> {
    try {
      // 1. Verify ownership
      const existingRecord = await prisma.batchRecord.findUnique({
        where: { id: recordId },
        include: { batch: true },
      });

      if (!existingRecord) {
        throw new Error('Record not found');
      }

      if (existingRecord.batch.userId !== userId) {
        throw new Error('Unauthorized: User does not own this record');
      }

      const batchId = existingRecord.batchId;

      // 2. Delete from Cassandra first (no foreign key constraints)
      await cassandraClient.connect();
      const cassandraDeleteQuery = `DELETE FROM contact_records WHERE batch_record_id = ?`;
      await cassandraClient['client']!.execute(
        cassandraDeleteQuery,
        [CassandraTypes.Uuid.fromString(recordId)],
        { prepare: true }
      );

      // 3. Delete from PostgreSQL (CASCADE safe)
      await prisma.batchRecord.delete({
        where: { id: recordId },
      });

      // 4. Update batch record count
      const remainingCount = await this.getRecordCountByBatchId(batchId);
      await prisma.batch.update({
        where: { id: batchId },
        data: { recordsCount: remainingCount },
      });

      console.log(`Successfully deleted record ${recordId}`);
    } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  }

  /**
   * Get full records for a batch with all Cassandra data
   * Useful for batch-records view page
   */
  async getFullRecordsForBatch(
    batchId: string,
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ records: ContactRecordFull[]; total: number }> {
    try {
      // 1. Verify user owns batch
      const batch = await prisma.batch.findFirst({
        where: { id: batchId, userId },
      });

      if (!batch) {
        throw new Error('Batch not found or access denied');
      }

      // 2. Get PostgreSQL records (for pagination and total count)
      const { records: pgRecords, total } = await this.getRecordsByBatchId(batchId, limit, offset);

      // 3. Fetch full Cassandra data for each record
      const fullRecords = await Promise.all(
        pgRecords.map((pgRecord) => this.getFullContactRecord(pgRecord.id))
      );

      return {
        records: fullRecords.filter((r): r is ContactRecordFull => r !== null),
        total,
      };
    } catch (error) {
      console.error('Error getting full records for batch:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const batchRecordRepository = new BatchRecordRepository();
