import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { dealSchema } from '../validators/crm.validators';
import { z } from 'zod';
import { list, getOne, create, update, remove, changeStage, analyze, getFullDetail, getDealDetail, getPipeline } from '../controllers/deal.controller';

const router = Router();
router.use(requireAuth);

// Static paths must be registered before the /:id catch-all so "pipeline" isn't parsed as an id.
router.get('/pipeline', getPipeline);

router.get('/', list);
router.post('/', validateBody(dealSchema), create);
router.get('/:id', getOne);
router.get('/:id/full', getFullDetail);
router.get('/:id/detail', getDealDetail);
router.patch('/:id', validateBody(dealSchema.partial()), update);
router.delete('/:id', remove);
router.post('/:id/stage', validateBody(z.object({ stageKey: z.string() })), changeStage);
router.patch('/:id/stage', validateBody(z.object({ stageKey: z.string() })), changeStage);
router.post('/:id/analyze', analyze);

export default router;
