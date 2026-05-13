/** Thrown when the projects API fails in a way we can explain clearly in the UI. */

import type { ProjectsErrorDisplay } from '../types/errors';

export class ProjectsApiUserError extends Error {
  readonly display: ProjectsErrorDisplay;

  constructor(display: ProjectsErrorDisplay) {
    super(`${display.headline} ${display.body}`);
    this.name = 'ProjectsApiUserError';
    this.display = display;
    Object.setPrototypeOf(this, ProjectsApiUserError.prototype);
  }
}

export function projectsErrorDisplayFromCaught(err: unknown): ProjectsErrorDisplay {
  if (err instanceof ProjectsApiUserError) {
    return err.display;
  }
  const message = err instanceof Error ? err.message : String(err);
  const trimmed = message.trim();
  return {
    headline: 'Something went wrong',
    body:
      trimmed ||
      'Projects could not be updated. Try again shortly, or reload the page if the problem continues.',
    technicalHint: trimmed ? trimmed.slice(0, 2000) : undefined,
  };
}
