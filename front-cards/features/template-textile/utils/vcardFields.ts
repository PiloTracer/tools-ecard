// vCard fields data structure based on vCard 4.0 (RFC 6350)
// Each field includes an ID (snake_case) and placeholder value with preserved trailing spaces

export interface VCardField {
  id: string;
  placeholder: string;
  category: 'core' | 'business' | 'personal';
}

export const vcardFields: VCardField[] = [
  // Core Contact Fields (All Cards)
  { id: 'full_name', placeholder: 'John Doe Frakenfort ', category: 'core' },
  { id: 'first_name', placeholder: 'John ', category: 'core' },
  { id: 'last_name', placeholder: 'Doe ', category: 'core' },

  // Contact methods
  { id: 'work_phone', placeholder: '+1 (555) 123-4567 ', category: 'core' },
  { id: 'work_phone_ext', placeholder: '123 ', category: 'core' },
  { id: 'mobile_phone', placeholder: '+1 (555) 987-6543 ', category: 'core' },
  { id: 'email', placeholder: 'john.doe@company.com ', category: 'core' },

  // Address (structured)
  { id: 'address_street', placeholder: '123 Main Street ', category: 'core' },
  { id: 'address_city', placeholder: 'New York ', category: 'core' },
  { id: 'address_state', placeholder: 'NY ', category: 'core' },
  { id: 'address_postal', placeholder: '10001 ', category: 'core' },
  { id: 'address_country', placeholder: 'USA ', category: 'core' },

  // Social profiles
  { id: 'social_instagram', placeholder: '@johndoe ', category: 'core' },
  { id: 'social_twitter', placeholder: '@johndoe_official ', category: 'core' },
  { id: 'social_facebook', placeholder: 'johndoe.profile ', category: 'core' },

  // Business Fields (Business Cards)
  { id: 'business_name', placeholder: 'Acme Corporation ', category: 'business' },
  { id: 'business_title', placeholder: 'Senior Developer ', category: 'business' },
  { id: 'business_department', placeholder: 'Engineering Supervisor ', category: 'business' },
  { id: 'business_url', placeholder: 'https://acme.com ', category: 'business' },
  { id: 'business_hours', placeholder: 'Mon-Fri 9AM-5PM EST ', category: 'business' },

  // Business address (optional override)
  { id: 'business_address_street', placeholder: '456 Business Ave ', category: 'business' },
  { id: 'business_address_city', placeholder: 'San Francisco ', category: 'business' },
  { id: 'business_address_state', placeholder: 'CA ', category: 'business' },
  { id: 'business_address_postal', placeholder: '94107 ', category: 'business' },
  { id: 'business_address_country', placeholder: 'USA ', category: 'business' },

  // Professional profiles
  { id: 'business_linkedin', placeholder: 'linkedin.com/in/johndoe ', category: 'business' },
  { id: 'business_twitter', placeholder: '@acme_official ', category: 'business' },

  // Personal Fields (Personal Cards)
  { id: 'personal_url', placeholder: 'https://johndoe.com ', category: 'personal' },
  { id: 'personal_bio', placeholder: 'Software engineer and photography enthusiast ', category: 'personal' },
  { id: 'personal_birthday', placeholder: '1990-05-15 ', category: 'personal' },
];

export function getFieldsByCategory(category: 'core' | 'business' | 'personal'): VCardField[] {
  return vcardFields.filter(field => field.category === category);
}

export function getFieldById(id: string): VCardField | undefined {
  return vcardFields.find(field => field.id === id);
}

// Helper to truncate placeholder for display in toolbox
export function truncatePlaceholder(placeholder: string, maxLength: number = 15): string {
  if (placeholder.length <= maxLength) return placeholder;
  return placeholder.substring(0, maxLength - 3) + '...';
}