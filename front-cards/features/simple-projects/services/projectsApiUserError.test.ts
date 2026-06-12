import { describe, it, expect } from '@jest/globals';
import {
  ProjectsApiUserError,
  projectsErrorDisplayFromCaught,
} from './projectsApiUserError';
import type { ProjectsErrorDisplay } from '../types/errors';

describe('ProjectsApiUserError', () => {
  it('should create error with display properties', () => {
    const display: ProjectsErrorDisplay = {
      headline: 'Connection failed',
      body: 'Could not reach the server.',
      technicalHint: 'ECONNREFUSED',
    };

    const error = new ProjectsApiUserError(display);
    expect(error.message).toBe('Connection failed Could not reach the server.');
    expect(error.name).toBe('ProjectsApiUserError');
    expect(error.display).toBe(display);
  });

  it('should create error without technical hint', () => {
    const display: ProjectsErrorDisplay = {
      headline: 'Not found',
      body: 'The project does not exist.',
    };

    const error = new ProjectsApiUserError(display);
    expect(error.message).toBe('Not found The project does not exist.');
    expect(error.display.technicalHint).toBeUndefined();
  });

  it('should be instance of Error', () => {
    const display: ProjectsErrorDisplay = {
      headline: 'Test',
      body: 'Body',
    };

    const error = new ProjectsApiUserError(display);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProjectsApiUserError);
  });
});

describe('projectsErrorDisplayFromCaught', () => {
  it('should extract display from ProjectsApiUserError', () => {
    const display: ProjectsErrorDisplay = {
      headline: 'Custom Error',
      body: 'Details here',
    };
    const error = new ProjectsApiUserError(display);

    const result = projectsErrorDisplayFromCaught(error);
    expect(result).toBe(display);
  });

  it('should handle standard Error', () => {
    const error = new Error('Something went wrong');
    const result = projectsErrorDisplayFromCaught(error);

    expect(result.headline).toBe('Something went wrong');
    expect(result.body).toBe('Something went wrong');
    expect(result.technicalHint).toBe('Something went wrong');
  });

  it('should handle string error', () => {
    const result = projectsErrorDisplayFromCaught('string error');
    expect(result.headline).toBe('Something went wrong');
    expect(result.body).toBe('string error');
    expect(result.technicalHint).toBe('string error');
  });

  it('should handle null error', () => {
    const result = projectsErrorDisplayFromCaught(null);
    expect(result.headline).toBe('Something went wrong');
    expect(result.body).toBe('null');
    expect(result.technicalHint).toBe('null');
  });

  it('should handle undefined error', () => {
    const result = projectsErrorDisplayFromCaught(undefined);
    expect(result.headline).toBe('Something went wrong');
    expect(result.body).toBe('undefined');
    expect(result.technicalHint).toBe('undefined');
  });

  it('should handle number error', () => {
    const result = projectsErrorDisplayFromCaught(404);
    expect(result.headline).toBe('Something went wrong');
    expect(result.body).toBe('404');
    expect(result.technicalHint).toBe('404');
  });

  it('should handle empty string error', () => {
    const result = projectsErrorDisplayFromCaught('');
    expect(result.headline).toBe('Something went wrong');
    expect(result.body).toContain('Try again shortly');
    expect(result.technicalHint).toBeUndefined();
  });

  it('should trim error messages', () => {
    const error = new Error('  spaced message  ');
    const result = projectsErrorDisplayFromCaught(error);
    expect(result.body).toBe('spaced message');
    expect(result.technicalHint).toBe('spaced message');
  });

  it('should limit technicalHint to 2000 characters', () => {
    const longMessage = 'a'.repeat(3000);
    const error = new Error(longMessage);
    const result = projectsErrorDisplayFromCaught(error);
    expect(result.technicalHint?.length).toBe(2000);
  });
});
