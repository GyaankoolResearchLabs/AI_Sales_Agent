import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Single shared Prisma Client instance for the whole process — the one and
 * only way the app talks to Postgres/Supabase. MongoDB/Mongoose has been
 * fully removed; this is the sole datastore.
 */
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error' as never, (e: unknown) => logger.error('Prisma error', { error: e }));
prisma.$on('warn' as never, (e: unknown) => logger.warn('Prisma warning', { warning: e }));

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Prisma connected to Postgres/Supabase');
  } catch (err) {
    logger.error('Prisma connection failed', { error: (err as Error).message });
    throw err;
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
