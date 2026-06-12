import { describe, it, expect } from '@jest/globals';
import { searchRecords } from './recordSearcher';
import type { ContactRecord } from '../types';

describe('Record Searcher', () => {
  const mockRecords: ContactRecord[] = [
    {
      id: '1',
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      workPhone: '123-456-7890',
      workPhoneExt: '101',
      mobilePhone: '+1-234-567-8901',
      addressStreet: '123 Main St',
      addressCity: 'New York',
      addressState: 'NY',
      addressPostal: '10001',
      addressCountry: 'USA',
      socialInstagram: '@johndoe',
      socialTwitter: '@johndoe',
      socialFacebook: 'johndoe',
      businessName: 'Acme Corp',
      businessTitle: 'CEO',
      businessDepartment: 'Executive',
      businessUrl: 'https://acme.com',
      businessHours: '9-5',
      businessAddressStreet: '456 Business Ave',
      businessAddressCity: 'San Francisco',
      businessAddressState: 'CA',
      businessAddressPostal: '94101',
      businessAddressCountry: 'USA',
      businessLinkedin: 'linkedin.com/in/johndoe',
      businessTwitter: '@acmeceo',
      personalUrl: 'https://johndoe.com',
      personalBio: 'Software developer',
      personalBirthday: '1990-01-01',
    },
    {
      id: '2',
      fullName: 'Jane Smith',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      workPhone: '987-654-3210',
      businessName: 'Beta Inc',
      businessTitle: 'CTO',
    },
  ];

  it('should return all records when query is empty', () => {
    const result = searchRecords(mockRecords, '');
    expect(result).toHaveLength(2);
  });

  it('should return all records when query is whitespace', () => {
    const result = searchRecords(mockRecords, '   ');
    expect(result).toHaveLength(2);
  });

  it('should search by full name', () => {
    const result = searchRecords(mockRecords, 'John');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search by email', () => {
    const result = searchRecords(mockRecords, 'jane@example.com');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('Jane Smith');
  });

  it('should search case-insensitively', () => {
    const result = searchRecords(mockRecords, 'JOHN');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search by phone number', () => {
    const result = searchRecords(mockRecords, '123-456-7890');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search by business name', () => {
    const result = searchRecords(mockRecords, 'Acme');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search by business title', () => {
    const result = searchRecords(mockRecords, 'CTO');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('Jane Smith');
  });

  it('should search by city', () => {
    const result = searchRecords(mockRecords, 'San Francisco');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search by social media handle', () => {
    const result = searchRecords(mockRecords, '@johndoe');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search by personal bio', () => {
    const result = searchRecords(mockRecords, 'developer');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search by URL', () => {
    const result = searchRecords(mockRecords, 'acme.com');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should return empty array when no matches found', () => {
    const result = searchRecords(mockRecords, 'nonexistent');
    expect(result).toHaveLength(0);
  });

  it('should trim the query string', () => {
    const result = searchRecords(mockRecords, '  John  ');
    expect(result).toHaveLength(1);
  });

  it('should handle partial matches', () => {
    const result = searchRecords(mockRecords, 'Doe');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('John Doe');
  });

  it('should search across all fields for a single match', () => {
    const result = searchRecords(mockRecords, 'Beta');
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe('Jane Smith');
  });

  it('should handle records with minimal fields', () => {
    const minimalRecords: ContactRecord[] = [
      {
        id: '3',
        fullName: 'Minimal User',
        firstName: 'Minimal',
        lastName: 'User',
      },
    ];
    const result = searchRecords(minimalRecords, 'Minimal');
    expect(result).toHaveLength(1);
  });
});
