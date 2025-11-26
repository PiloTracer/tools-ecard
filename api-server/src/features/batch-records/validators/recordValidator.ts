/**
 * Record Validator
 * Input validation schemas for batch record operations
 */

export interface RecordUpdateInput {
  // Core fields
  fullName?: string;
  firstName?: string;
  lastName?: string;

  // Contact methods
  workPhone?: string;
  workPhoneExt?: string;
  mobilePhone?: string;
  email?: string;

  // Address
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostal?: string;
  addressCountry?: string;

  // Social
  socialInstagram?: string;
  socialTwitter?: string;
  socialFacebook?: string;

  // Business
  businessName?: string;
  businessTitle?: string;
  businessDepartment?: string;
  businessUrl?: string;
  businessHours?: string;

  // Business address
  businessAddressStreet?: string;
  businessAddressCity?: string;
  businessAddressState?: string;
  businessAddressPostal?: string;
  businessAddressCountry?: string;

  // Professional
  businessLinkedin?: string;
  businessTwitter?: string;

  // Personal
  personalUrl?: string;
  personalBio?: string;
  personalBirthday?: string;

  // Extra
  extra?: Record<string, string>;
}

export class RecordValidator {
  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (basic format check)
   */
  static validatePhone(phone: string): boolean {
    // Accept various formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize input to prevent XSS
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate and sanitize record update input
   */
  static validateUpdateInput(input: RecordUpdateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate email if provided
    if (input.email !== undefined && input.email !== null && input.email !== '') {
      if (!this.validateEmail(input.email)) {
        errors.push('Invalid email format');
      }
    }

    // Validate phone numbers if provided
    if (input.workPhone && !this.validatePhone(input.workPhone)) {
      errors.push('Invalid work phone format');
    }

    if (input.mobilePhone && !this.validatePhone(input.mobilePhone)) {
      errors.push('Invalid mobile phone format');
    }

    // Validate URLs if provided
    if (input.businessUrl && !this.validateUrl(input.businessUrl)) {
      errors.push('Invalid business URL format');
    }

    if (input.personalUrl && !this.validateUrl(input.personalUrl)) {
      errors.push('Invalid personal URL format');
    }

    // Sanitize all string fields
    const sanitizedInput = { ...input };
    for (const [key, value] of Object.entries(sanitizedInput)) {
      if (typeof value === 'string') {
        (sanitizedInput as any)[key] = this.sanitizeString(value);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
