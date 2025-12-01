/**
 * Prisma Client Wrapper
 * Provides database connection and operations for PostgreSQL
 */

import { PrismaClient } from '@prisma/client';

// Extend PrismaClient with logging in development
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']  // Removed 'query' to reduce log noise
      : ['error'],
    errorFormat: 'pretty',
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Prevent multiple instances in development
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Template operations
export const templateOperations = {
  /**
   * Create or update template metadata
   */
  async upsertTemplate(data: {
    id: string;
    userId: string;
    projectId: string;
    projectName: string;
    name: string;
    width: number;
    height: number;
    exportWidth: number;
    exportHeight: number;
    storageUrl: string;
    storageMode: string;
    elementCount?: number;
    thumbnailUrl?: string;
    isPublic?: boolean;
    syncStatus?: string;
    version?: number;
  }) {
    return prisma.templateMetadata.upsert({
      where: {
        id: data.id
      },
      create: data,
      update: {
        ...data,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Get template by ID
   */
  async getTemplate(id: string, userId: string) {
    return prisma.templateMetadata.findFirst({
      where: {
        id,
        userId
      },
      include: {
        resources: true,
        project: true
      }
    });
  },

  /**
   * List templates for a user
   */
  async listTemplates(
    userId: string,
    projectId?: string,
    page: number = 1,
    pageSize: number = 20
  ) {
    const where = {
      userId,
      ...(projectId && { projectId })
    };

    const [templates, total] = await Promise.all([
      prisma.templateMetadata.findMany({
        where,
        include: {
          project: true,
          resources: {
            select: {
              id: true,
              type: true,
              size: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.templateMetadata.count({ where })
    ]);

    return {
      templates,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  },

  /**
   * Delete template
   */
  async deleteTemplate(id: string, userId: string) {
    // This will cascade delete resources, versions, and shares
    return prisma.templateMetadata.delete({
      where: {
        id,
        userId
      }
    });
  },

  /**
   * Update template sync status
   */
  async updateSyncStatus(id: string, syncStatus: 'synced' | 'pending' | 'failed') {
    return prisma.templateMetadata.update({
      where: { id },
      data: { syncStatus }
    });
  }
};

// Resource operations
export const resourceOperations = {
  /**
   * Create resource record
   */
  async createResource(data: {
    id?: string;
    templateId: string;
    name: string;
    type: string;
    storageUrl: string;
    storageMode: string;
    hash: string;
    size: number;
    mimeType: string;
  }) {
    return prisma.templateResource.create({
      data
    });
  },

  /**
   * Find resource by hash (for deduplication)
   */
  async findResourceByHash(hash: string) {
    return prisma.templateResource.findUnique({
      where: { hash }
    });
  },

  /**
   * Get resources for a template
   */
  async getTemplateResources(templateId: string) {
    return prisma.templateResource.findMany({
      where: { templateId }
    });
  },

  /**
   * Update resource storage URL (for migration)
   */
  async updateResourceUrl(resourceId: string, newUrl: string) {
    return prisma.templateResource.update({
      where: { id: resourceId },
      data: { storageUrl: newUrl }
    });
  },

  /**
   * Delete orphaned resources
   */
  async deleteOrphanedResources() {
    // Find resources not linked to any template
    const orphaned = await prisma.$queryRaw`
      SELECT r.id
      FROM template_resources r
      LEFT JOIN template_metadata t ON r.template_id = t.id
      WHERE t.id IS NULL
    `;

    if (Array.isArray(orphaned) && orphaned.length > 0) {
      const ids = orphaned.map((r: any) => r.id);
      return prisma.templateResource.deleteMany({
        where: {
          id: { in: ids }
        }
      });
    }

    return { count: 0 };
  }
};

// Template version operations
export const versionOperations = {
  /**
   * Create template version
   */
  async createVersion(data: {
    templateId: string;
    version: number;
    storageUrl: string;
  }) {
    return prisma.templateVersion.create({
      data
    });
  },

  /**
   * Get template versions
   */
  async getVersions(templateId: string) {
    return prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: {
        version: 'desc'
      }
    });
  },

  /**
   * Delete old versions (keep last N versions)
   */
  async pruneVersions(templateId: string, keepCount: number = 3) {
    const versions = await prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: {
        version: 'desc'
      },
      skip: keepCount
    });

    if (versions.length > 0) {
      const idsToDelete = versions.map(v => v.id);
      return prisma.templateVersion.deleteMany({
        where: {
          id: { in: idsToDelete }
        }
      });
    }

    return { count: 0 };
  }
};

// Template share operations
export const shareOperations = {
  /**
   * Create share link
   */
  async createShare(data: {
    templateId: string;
    sharedWithId?: string;
    permission?: string;
    expiresAt?: Date;
  }) {
    const shareToken = generateShareToken();

    return prisma.templateShare.create({
      data: {
        ...data,
        shareToken,
        permission: data.permission || 'view'
      }
    });
  },

  /**
   * Get share by token
   */
  async getShareByToken(shareToken: string) {
    return prisma.templateShare.findUnique({
      where: { shareToken },
      include: {
        template: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });
  },

  /**
   * Revoke share
   */
  async revokeShare(id: string) {
    return prisma.templateShare.delete({
      where: { id }
    });
  },

  /**
   * Clean expired shares
   */
  async cleanExpiredShares() {
    return prisma.templateShare.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
  }
};

// User operations
export const userOperations = {
  /**
   * Get or create user from OAuth
   */
  async upsertUser(data: {
    id: string;
    email: string;
    name?: string;
    oauthId?: string;
  }) {
    return prisma.user.upsert({
      where: {
        id: data.id
      },
      create: data,
      update: {
        email: data.email,
        name: data.name,
        oauthId: data.oauthId,
        updatedAt: new Date()
      }
    });
  },

  /**
   * Get user by ID
   */
  async getUser(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        projects: true,
        projectSelection: true
      }
    });
  },

  /**
   * Get user by OAuth ID
   */
  async getUserByOAuthId(oauthId: string) {
    return prisma.user.findUnique({
      where: { oauthId }
    });
  }
};

// Project operations
export const projectOperations = {
  /**
   * Create project
   */
  async createProject(data: {
    userId: string;
    name: string;
    isDefault?: boolean;
  }) {
    return prisma.project.create({
      data
    });
  },

  /**
   * Get or create default project
   * Uses Prisma upsert to handle race conditions atomically
   */
  async getOrCreateDefaultProject(userId: string) {
    try {
      // Use upsert to atomically create-or-get
      // The unique constraint @@unique([userId, name]) ensures this is safe
      const project = await prisma.project.upsert({
        where: {
          // Compound unique key: userId + name
          userId_name: {
            userId,
            name: 'Default Project'
          }
        },
        update: {
          // If exists, ensure it's marked as default
          isDefault: true
        },
        create: {
          // If doesn't exist, create it
          userId,
          name: 'Default Project',
          isDefault: true
        }
      });

      return project;
    } catch (error: any) {
      // Upsert should handle race conditions, but catch just in case
      console.error('[ProjectOperations] Failed to get or create default project:', error);

      // Fallback: try to find it
      const existingProject = await prisma.project.findFirst({
        where: {
          userId,
          OR: [
            { isDefault: true },
            { name: 'Default Project' }
          ]
        }
      });

      if (existingProject) {
        return existingProject;
      }

      // Re-throw if we still can't find or create it
      throw error;
    }
  },

  /**
   * List user projects
   */
  async listProjects(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });
  },

  /**
   * Set selected project
   */
  async setSelectedProject(userId: string, projectId: string) {
    return prisma.userProjectSelection.upsert({
      where: { userId },
      create: {
        userId,
        projectId
      },
      update: {
        projectId,
        selectedAt: new Date()
      }
    });
  },

  /**
   * Ensure user has a default project (alias for getOrCreateDefaultProject)
   */
  async ensureDefaultProject(userId: string) {
    return this.getOrCreateDefaultProject(userId);
  }
};

// Utility functions
function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}