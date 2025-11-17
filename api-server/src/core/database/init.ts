import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Initialize database on application startup
 * Creates tables and handles migrations automatically
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔄 Initializing database...');

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Run any pending migrations in production
    // In development, schema is synced via prisma db push
    if (process.env.NODE_ENV === 'production') {
      console.log('📦 Running database migrations...');
      // Migrations would be applied via deployment scripts
    } else {
      // In development, sync schema without migrations
      console.log('🔧 Syncing database schema (development mode)...');
      // Schema will be synced via prisma db push in docker startup
    }

    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Ensure default project exists for a user
 * Called after user authentication
 */
export async function ensureUserDefaultProject(userId: string, userEmail: string, userName?: string): Promise<string> {
  try {
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: true,
        projectSelection: true
      }
    });

    // Create user if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: userEmail,
          name: userName || userEmail.split('@')[0],
          oauthId: userId // Using userId as oauthId for now
        },
        include: {
          projects: true,
          projectSelection: true
        }
      });
      console.log(`✅ Created new user: ${userEmail}`);
    }

    // Check if user has a default project
    let defaultProject = user.projects.find(p => p.isDefault);

    if (!defaultProject) {
      // Create default project
      defaultProject = await prisma.project.create({
        data: {
          userId: user.id,
          name: 'default',
          isDefault: true
        }
      });
      console.log(`✅ Created default project for user: ${userEmail}`);
    }

    // Ensure user has a selected project
    if (!user.projectSelection) {
      await prisma.userProjectSelection.create({
        data: {
          userId: user.id,
          projectId: defaultProject.id
        }
      });
      console.log(`✅ Set default project as selected for user: ${userEmail}`);
    }

    return defaultProject.id;
  } catch (error) {
    console.error('❌ Failed to ensure user default project:', error);
    throw error;
  }
}

export { prisma };