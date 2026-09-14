import { Router } from 'express';
import { requireAuth, managerUp } from '../middleware/auth';
import { dailyBriefing, managerDashboard, followUpPerformance } from '../controllers/dashboard.controller';

const router = Router();
router.use(requireAuth);

router.get('/briefing', dailyBriefing);
router.get('/manager', managerUp, managerDashboard);
router.get('/follow-up-performance', managerUp, followUpPerformance);

export default router;
