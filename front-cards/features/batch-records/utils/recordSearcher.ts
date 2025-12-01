/**
 * Record Searcher Utility
 * Client-side full-text search across all record fields
 */

import type { ContactRecord } from '../types';

/**
 * Search records by query string across all fields
 */
export function searchRecords(records: ContactRecord[], query: string): ContactRecord[] {
  if (!query || query.trim() === '') {
    return records;
  }

  const lowerQuery = query.toLowerCase().trim();

  return records.filter((record) => {
    // Build searchable text from ALL fields
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
