import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { forecast } from '../controllers/ai.controller';

const router = Router();
router.use(requireAuth);

router.get('/', forecast);

export default router;
