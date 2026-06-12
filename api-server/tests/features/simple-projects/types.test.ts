import { describe, it, expect } from '@jest/globals';
import {
  Project,
  UserProjectSelection,
  CreateProjectDto,
  UpdateSelectedProjectDto,
  UpdateProjectDto,
  ProjectWithSelection,
} from '../../../src/features/simple-projects/types';

describe('Simple Projects Types', () => {
  it('should create a valid Project object', () => {
    const project: Project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      name: 'Test Project',
      isDefault: false,
      workPhonePrefix: '2222',
      defaultCountryCode: '+(506)',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    expect(project.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(project.name).toBe('Test Project');
    expect(project.isDefault).toBe(false);
    expect(project.workPhonePrefix).toBe('2222');
    expect(project.defaultCountryCode).toBe('+(506)');
  });

  it('should create a Project with null phone fields', () => {
    const project: Project = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      name: 'Test Project',
      isDefault: true,
      workPhonePrefix: null,
      defaultCountryCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(project.workPhonePrefix).toBeNull();
    expect(project.defaultCountryCode).toBeNull();
    expect(project.isDefault).toBe(true);
  });

  it('should create a valid UserProjectSelection', () => {
    const selection: UserProjectSelection = {
      userId: 'user-123',
      projectId: 'proj-456',
      selectedAt: new Date('2024-01-15'),
    };

    expect(selection.userId).toBe('user-123');
    expect(selection.projectId).toBe('proj-456');
  });

  it('should create a valid CreateProjectDto', () => {
    const dto: CreateProjectDto = {
      name: 'My New Project',
    };

    expect(dto.name).toBe('My New Project');
  });

  it('should create a valid UpdateSelectedProjectDto', () => {
    const dto: UpdateSelectedProjectDto = {
      projectId: 'proj-789',
    };

    expect(dto.projectId).toBe('proj-789');
  });

  it('should create a valid UpdateProjectDto with all fields', () => {
    const dto: UpdateProjectDto = {
      workPhonePrefix: '1234',
      defaultCountryCode: '+(1)',
    };

    expect(dto.workPhonePrefix).toBe('1234');
    expect(dto.defaultCountryCode).toBe('+(1)');
  });

  it('should create a valid UpdateProjectDto with partial fields', () => {
    const dto: UpdateProjectDto = {
      workPhonePrefix: null,
    };

    expect(dto.workPhonePrefix).toBeNull();
    expect(dto.defaultCountryCode).toBeUndefined();
  });

  it('should create a valid ProjectWithSelection', () => {
    const project: ProjectWithSelection = {
      id: 'proj-123',
      userId: 'user-123',
      name: 'Selected Project',
      isDefault: false,
      workPhonePrefix: null,
      defaultCountryCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isSelected: true,
    };

    expect(project.isSelected).toBe(true);
  });
});
