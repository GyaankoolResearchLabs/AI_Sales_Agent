import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { activitySchema } from '../validators/crm.validators';
import { list, getOne, create, update, remove } from '../controllers/activity.controller';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/', validateBody(activitySchema), create);
router.get('/:id', getOne);
router.patch('/:id', validateBody(activitySchema.partial()), update);
router.delete('/:id', remove);

export default router;
