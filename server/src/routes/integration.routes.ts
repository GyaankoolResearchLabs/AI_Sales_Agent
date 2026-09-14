import { Router } from 'express';
import { requireAuth, directorUp } from '../middleware/auth';
import { list, connect, disconnect } from '../controllers/integration.controller';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/:provider/connect', directorUp, connect);
router.post('/:provider/disconnect', directorUp, disconnect);

export default router;
