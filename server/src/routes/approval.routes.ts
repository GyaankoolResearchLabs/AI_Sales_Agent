import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createApprovalSchema, rejectApprovalSchema } from '../validators/approval.validators';
import { list, getOne, create, approve, reject } from '../controllers/approval.controller';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/', validateBody(createApprovalSchema), create);
router.get('/:id', getOne);
router.post('/:id/approve', approve);
router.post('/:id/reject', validateBody(rejectApprovalSchema), reject);

export default router;
