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
}

// Export singleton instance
export const batchRecordRepository = new BatchRecordRepository();
