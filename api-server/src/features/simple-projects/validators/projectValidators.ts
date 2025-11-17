import { z } from 'zod';

export const projectValidators = {
  create: z.object({
    body: z.object({
      name: z.string()
        .min(1, 'Project name is required')
        .max(255, 'Project name must be less than 255 characters')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Project name can only contain letters, numbers, spaces, hyphens, and underscores')
    })
  }),

  updateSelected: z.object({
    body: z.object({
      projectId: z.string().uuid('Invalid project ID format')
    })
  }),

  getById: z.object({
    params: z.object({
      id: z.string().uuid('Invalid project ID format')
    })
  })
};