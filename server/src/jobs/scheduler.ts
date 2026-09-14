import { prisma } from '../config/prisma';
import { rescoreAllOpenDeals } from '../ai/dealScoring.service';
import { detectAnomalies } from '../ai/anomalyDetection.service';
import { logger } from '../utils/logger';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Periodically re-scores open deals and re-runs anomaly detection for every
 * organization, so "no activity for 7 days" style insights surface even
 * without a user opening the affected deal. Runs in-process — fine for a
 * single server instance; swap for a real job queue (BullMQ, etc.) at scale.
 */
export function startScheduler() {
  const run = async () => {
    try {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        await rescoreAllOpenDeals(org.id);
        await detectAnomalies(org.id);
      }
      if (orgs.length > 0) logger.info(`Scheduler: rescored deals and refreshed insights for ${orgs.length} organization(s)`);
    } catch (err) {
      logger.error('Scheduler run failed', { error: (err as Error).message });
    }
  };

  // Run once shortly after boot, then on an interval.
  setTimeout(run, 10_000);
  setInterval(run, INTERVAL_MS);
}
