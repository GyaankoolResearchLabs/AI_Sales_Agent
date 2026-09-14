import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { leadSchema } from '../validators/crm.validators';
import { list, getOne, create, update, remove, getTimeline, rescore, assignOwner } from '../controllers/lead.controller';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/', validateBody(leadSchema), create);
router.get('/:id', getOne);
router.patch('/:id', validateBody(leadSchema.partial()), update);
router.delete('/:id', remove);
router.get('/:id/timeline', getTimeline);
router.post('/:id/rescore', rescore);
router.post('/:id/assign', assignOwner);

export default router;
