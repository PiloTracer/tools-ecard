/**
 * Prisma client for render-worker
 * Shares the same schema as api-server
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('Database disconnected');
}
