/**
 * Prisma client singleton
 * PostgreSQL connection
 */

import { PrismaClient } from '@prisma/client';
import { appConfig } from '../config';

// TODO [backend]: Initialize Prisma with actual schema
// For now, export a placeholder

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: appConfig.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (appConfig.env !== 'production') globalThis.prisma = prisma;
