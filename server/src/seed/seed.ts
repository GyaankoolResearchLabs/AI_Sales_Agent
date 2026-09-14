import { logger } from '../utils/logger';
import { runSeed } from './seedLogic';
import { disconnectPrisma } from '../config/prisma';

runSeed()
  .then(() => disconnectPrisma())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed failed', { error: err instanceof Error ? err.message : err });
    process.exit(1);
  });
