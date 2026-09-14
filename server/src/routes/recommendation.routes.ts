import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { list, generateForDeal, createQuickRecommendation, prepare, editContent, approve, reject, execute } from '../controllers/recommendation.controller';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/generate', generateForDeal);
router.post('/quick', createQuickRecommendation);
router.post('/:id/prepare', prepare);
router.patch('/:id/content', editContent);
router.post('/:id/approve', approve);
router.post('/:id/reject', reject);
router.post('/:id/execute', execute);

export default router;
