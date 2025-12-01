/**
 * vCard Generator Service
 * Generates vCard 3.0 data from field values
 */

/**
 * Field values for vCard generation
 * Can come from canvas text elements or batch records
 */
export interface VCardFieldValues {
  // Core
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;

  // Contact
  work_phone?: string | null;
  work_phone_ext?: string | null;
  mobile_phone?: string | null;
  email?: string | null;

  // Address
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal?: string | null;
  address_country?: string | null;

  // Social
  social_instagram?: string | null;
  social_twitter?: string | null;
  social_facebook?: string | null;

  // Business
  business_name?: string | null;
  business_title?: string | null;
  business_department?: string | null;
  business_url?: string | null;
  business_hours?: string | null;

  // Business Address
  business_address_street?: string | null;
  business_address_city?: string | null;
  business_address_state?: string | null;
  business_address_postal?: string | null;
  business_address_country?: string | null;

  // Professional
  business_linkedin?: string | null;
  business_twitter?: string | null;

  // Personal
  personal_url?: string | null;
  personal_bio?: string | null;
  personal_birthday?: string | null;
}

/**
 * Generate vCard 3.0 data from field values
 */
export function generateVCard(fieldValues: VCardFieldValues): string {
  const vCardLines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  // FN (Full Name) - required field
  if (fieldValues.full_name) {
    vCardLines.push(`FN:${fieldValues.full_name}`);
  }

  // N (Structured Name) - family;given;additional;prefix;suffix
  if (fieldValues.first_name || fieldValues.last_name) {
    const lastName = fieldValues.last_name || '';
    const firstName = fieldValues.first_name || '';
    vCardLines.push(`N:${lastName};${firstName};;;`);
  }

  // ORG (Organization) - using business_name or business_department
  if (fieldValues.business_name) {
    // If department exists, format as "Company;Department"
    if (fieldValues.business_department) {
      vCardLines.push(`ORG:${fieldValues.business_name};${fieldValues.business_department}`);
    } else {
      vCardLines.push(`ORG:${fieldValues.business_name}`);
    }
  }

  // TITLE (Job Title)
  if (fieldValues.business_title) {
    vCardLines.push(`TITLE:${fieldValues.business_title}`);
  }

  // TEL (Phone numbers) - All specific fields from vcardFields.ts
  if (fieldValues.work_phone) {
    // Add extension if present
    if (fieldValues.work_phone_ext) {
      vCardLines.push(`TEL;TYPE=WORK,VOICE:${fieldValues.work_phone} ext ${fieldValues.work_phone_ext}`);
    } else {
      vCardLines.push(`TEL;TYPE=WORK,VOICE:${fieldValues.work_phone}`);
    }
  }
  if (fieldValues.mobile_phone) {
    vCardLines.push(`TEL;TYPE=CELL:${fieldValues.mobile_phone}`);
  }

  // EMAIL
  if (fieldValues.email) {
    vCardLines.push(`EMAIL;TYPE=INTERNET,WORK:${fieldValues.email}`);
  }

  // ADR (Work Address) - Using specific address_* fields
  if (fieldValues.address_street || fieldValues.address_city || fieldValues.address_state ||
      fieldValues.address_postal || fieldValues.address_country) {
    const street = fieldValues.address_street || '';
    const city = fieldValues.address_city || '';
    const state = fieldValues.address_state || '';
    const postal = fieldValues.address_postal || '';
    const country = fieldValues.address_country || '';
    vCardLines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${postal};${country}`);
  }

  // Business Address (if different from main address)
  if (fieldValues.business_address_street || fieldValues.business_address_city ||
      fieldValues.business_address_state || fieldValues.business_address_postal ||
      fieldValues.business_address_country) {
    const street = fieldValues.business_address_street || '';
    const city = fieldValues.business_address_city || '';
    const state = fieldValues.business_address_state || '';
    const postal = fieldValues.business_address_postal || '';
    const country = fieldValues.business_address_country || '';
    vCardLines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${postal};${country}`);
  }

  // URL (Business website)
  if (fieldValues.business_url) {
    vCardLines.push(`URL;TYPE=WORK:${fieldValues.business_url}`);
  }

  // Personal URL
  if (fieldValues.personal_url) {
    vCardLines.push(`URL;TYPE=HOME:${fieldValues.personal_url}`);
  }

  // Social media profiles - LinkedIn
  if (fieldValues.business_linkedin) {
    // Normalize LinkedIn URL
    let linkedinUrl = fieldValues.business_linkedin;
    if (!linkedinUrl.startsWith('http')) {
      linkedinUrl = linkedinUrl.startsWith('linkedin.com')
        ? `https://${linkedinUrl}`
        : `https://linkedin.com/in/${linkedinUrl}`;
    }
    vCardLines.push(`URL;TYPE=LinkedIn:${linkedinUrl}`);
  }

  // Social media - Instagram
  if (fieldValues.social_instagram) {
    const username = fieldValues.social_instagram.replace('@', '');
    vCardLines.push(`URL;TYPE=Instagram:https://instagram.com/${username}`);
  }

  // Social media - Twitter (business and personal)
  if (fieldValues.business_twitter) {
    const username = fieldValues.business_twitter.replace('@', '');
    vCardLines.push(`URL;TYPE=Twitter:https://twitter.com/${username}`);
  } else if (fieldValues.social_twitter) {
    const username = fieldValues.social_twitter.replace('@', '');
    vCardLines.push(`URL;TYPE=Twitter:https://twitter.com/${username}`);
  }

  // Social media - Facebook
  if (fieldValues.social_facebook) {
    vCardLines.push(`URL;TYPE=Facebook:https://facebook.com/${fieldValues.social_facebook}`);
  }

  // BDAY (Birthday) - ISO 8601 format
  if (fieldValues.personal_birthday) {
    vCardLines.push(`BDAY:${fieldValues.personal_birthday}`);
  }

  // NOTE (Additional information)
  const noteItems: string[] = [];

  if (fieldValues.business_hours) {
    noteItems.push(`Business Hours: ${fieldValues.business_hours}`);
  }

  if (fieldValues.personal_bio) {
    noteItems.push(fieldValues.personal_bio);
  }

  if (noteItems.length > 0) {
    vCardLines.push(`NOTE:${noteItems.join(' | ')}`);
  }

  vCardLines.push('END:VCARD');
  return vCardLines.join('\r\n'); // Use \r\n for proper vCard format
}

/**
 * Generate vCard from batch record (camelCase properties)
 * Converts camelCase to snake_case for vCard generation
 */
export function generateVCardFromRecord(record: any): string {
  const fieldValues: VCardFieldValues = {
    // Core
    full_name: record.fullName,
    first_name: record.firstName,
    last_name: record.lastName,

    // Contact
    work_phone: record.workPhone,
    work_phone_ext: record.workPhoneExt,
    mobile_phone: record.mobilePhone,
    email: record.email,

    // Address
    address_street: record.addressStreet,
    address_city: record.addressCity,
    address_state: record.addressState,
    address_postal: record.addressPostal,
    address_country: record.addressCountry,

    // Social
    social_instagram: record.socialInstagram,
    social_twitter: record.socialTwitter,
    social_facebook: record.socialFacebook,

    // Business
    business_name: record.businessName,
    business_title: record.businessTitle,
    business_department: record.businessDepartment,
    business_url: record.businessUrl,
    business_hours: record.businessHours,

    // Business Address
    business_address_street: record.businessAddressStreet,
    business_address_city: record.businessAddressCity,
    business_address_state: record.businessAddressState,
    business_address_postal: record.businessAddressPostal,
    business_address_country: record.businessAddressCountry,

    // Professional
    business_linkedin: record.businessLinkedin,
    business_twitter: record.businessTwitter,

    // Personal
    personal_url: record.personalUrl,
    personal_bio: record.personalBio,
    personal_birthday: record.personalBirthday,
  };

  return generateVCard(fieldValues);
}

/**
 * Generate vCard from template text elements
 * Extracts field values from text elements with fieldId
 */
export function generateVCardFromElements(elements: any[]): string {
  // Collect all text elements that have a fieldId (vCard fields)
  const fieldElements = elements.filter(el =>
    el.type === 'text' && el.fieldId
  );

  // Build a map of field values
  const fieldValues: VCardFieldValues = {};
  fieldElements.forEach(el => {
    (fieldValues as any)[el.fieldId] = el.text || '';
  });

  return generateVCard(fieldValues);
}
