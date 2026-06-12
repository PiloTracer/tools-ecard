import { describe, it, expect } from '@jest/globals';
import { projectValidators } from '../../../src/features/simple-projects/validators/projectValidators';

describe('Project Validators', () => {
  describe('create validator', () => {
    it('should validate valid project name', () => {
      const result = projectValidators.create.safeParse({
        body: { name: 'My Project' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty project name', () => {
      const result = projectValidators.create.safeParse({
        body: { name: '' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Project name is required');
      }
    });

    it('should reject project name exceeding 255 characters', () => {
      const result = projectValidators.create.safeParse({
        body: { name: 'a'.repeat(256) },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Project name must be less than 255 characters');
      }
    });

    it('should reject project name with special characters', () => {
      const result = projectValidators.create.safeParse({
        body: { name: 'Project @#$%' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
        );
      }
    });

    it('should accept project name with hyphens and underscores', () => {
      const result = projectValidators.create.safeParse({
        body: { name: 'My-Project_123' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept single character project name', () => {
      const result = projectValidators.create.safeParse({
        body: { name: 'A' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateSelected validator', () => {
    it('should validate valid project ID', () => {
      const result = projectValidators.updateSelected.safeParse({
        body: { projectId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid project ID format', () => {
      const result = projectValidators.updateSelected.safeParse({
        body: { projectId: 'not-a-uuid' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid project ID format');
      }
    });

    it('should reject empty project ID', () => {
      const result = projectValidators.updateSelected.safeParse({
        body: { projectId: '' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getById validator', () => {
    it('should validate valid project ID', () => {
      const result = projectValidators.getById.safeParse({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid project ID format', () => {
      const result = projectValidators.getById.safeParse({
        params: { id: 'invalid-id' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid project ID format');
      }
    });
  });
});
