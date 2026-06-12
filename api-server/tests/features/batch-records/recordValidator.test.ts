import { describe, it, expect } from '@jest/globals';
import { RecordValidator } from '../../../src/features/batch-records/validators/recordValidator';

describe('RecordValidator', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(RecordValidator.validateEmail('test@example.com')).toBe(true);
      expect(RecordValidator.validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(RecordValidator.validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(RecordValidator.validateEmail('invalid')).toBe(false);
      expect(RecordValidator.validateEmail('@example.com')).toBe(false);
      expect(RecordValidator.validateEmail('user@')).toBe(false);
      expect(RecordValidator.validateEmail('user@domain')).toBe(false);
      expect(RecordValidator.validateEmail('')).toBe(false);
      expect(RecordValidator.validateEmail('user@@example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone formats', () => {
      expect(RecordValidator.validatePhone('+1234567890')).toBe(true);
      expect(RecordValidator.validatePhone('(123) 456-7890')).toBe(true);
      expect(RecordValidator.validatePhone('123-456-7890')).toBe(true);
      expect(RecordValidator.validatePhone('1234567890')).toBe(true);
      expect(RecordValidator.validatePhone('+1 234 567 8901')).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      expect(RecordValidator.validatePhone('abc')).toBe(false);
      expect(RecordValidator.validatePhone('123')).toBe(false);
      expect(RecordValidator.validatePhone('')).toBe(false);
      expect(RecordValidator.validatePhone('123-abc')).toBe(false);
    });

    it('should reject phone numbers with fewer than 7 digits', () => {
      expect(RecordValidator.validatePhone('123456')).toBe(false);
      expect(RecordValidator.validatePhone('1-2-3-4-5-6')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(RecordValidator.validateUrl('https://example.com')).toBe(true);
      expect(RecordValidator.validateUrl('http://localhost:3000')).toBe(true);
      expect(RecordValidator.validateUrl('ftp://files.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(RecordValidator.validateUrl('not-a-url')).toBe(false);
      expect(RecordValidator.validateUrl('')).toBe(false);
      expect(RecordValidator.validateUrl('http://')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize HTML tags', () => {
      expect(RecordValidator.sanitizeString('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should sanitize single quotes', () => {
      expect(RecordValidator.sanitizeString("it's a test")).toBe('it&#x27;s a test');
    });

    it('should sanitize forward slashes', () => {
      expect(RecordValidator.sanitizeString('path/to/file')).toBe('path&#x2F;to&#x2F;file');
    });

    it('should leave safe strings unchanged', () => {
      expect(RecordValidator.sanitizeString('hello world')).toBe('hello world');
      expect(RecordValidator.sanitizeString('123')).toBe('123');
    });
  });

  describe('validateUpdateInput', () => {
    it('should validate empty input', () => {
      const result = RecordValidator.validateUpdateInput({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid email', () => {
      const result = RecordValidator.validateUpdateInput({ email: 'test@example.com' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const result = RecordValidator.validateUpdateInput({ email: 'invalid-email' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should skip email validation for empty string', () => {
      const result = RecordValidator.validateUpdateInput({ email: '' });
      expect(result.valid).toBe(true);
    });

    it('should skip email validation for null', () => {
      const result = RecordValidator.validateUpdateInput({ email: null as any });
      expect(result.valid).toBe(true);
    });

    it('should validate valid work phone', () => {
      const result = RecordValidator.validateUpdateInput({ workPhone: '(123) 456-7890' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid work phone', () => {
      const result = RecordValidator.validateUpdateInput({ workPhone: 'abc' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid work phone format');
    });

    it('should validate valid mobile phone', () => {
      const result = RecordValidator.validateUpdateInput({ mobilePhone: '+1234567890' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid mobile phone', () => {
      const result = RecordValidator.validateUpdateInput({ mobilePhone: '123' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid mobile phone format');
    });

    it('should validate valid business URL', () => {
      const result = RecordValidator.validateUpdateInput({ businessUrl: 'https://company.com' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid business URL', () => {
      const result = RecordValidator.validateUpdateInput({ businessUrl: 'not-a-url' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid business URL format');
    });

    it('should validate valid personal URL', () => {
      const result = RecordValidator.validateUpdateInput({ personalUrl: 'https://personal.com' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid personal URL', () => {
      const result = RecordValidator.validateUpdateInput({ personalUrl: 'bad-url' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid personal URL format');
    });

    it('should collect multiple errors', () => {
      const result = RecordValidator.validateUpdateInput({
        email: 'bad',
        workPhone: 'short',
        mobilePhone: 'abc',
        businessUrl: 'nope',
        personalUrl: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(5);
    });

    it('should accept extra fields', () => {
      const result = RecordValidator.validateUpdateInput({
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        extra: { custom: 'value' },
      });
      expect(result.valid).toBe(true);
    });
  });
});
