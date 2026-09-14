import { Router } from 'express';
import { requireAuth, directorUp } from '../middleware/auth';
import { autonomySettings } from '../controllers/recommendation.controller';

const router = Router();
router.use(requireAuth);

router.get('/', autonomySettings.get);
router.put('/', directorUp, autonomySettings.update);

export default router;
