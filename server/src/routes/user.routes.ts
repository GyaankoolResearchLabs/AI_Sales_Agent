import { Router } from 'express';
import { requireAuth, managerUp } from '../middleware/auth';
import { listUsers, inviteUser, updateUser, removeUser } from '../controllers/user.controller';

const router = Router();
router.use(requireAuth);

router.get('/', listUsers);
router.post('/', managerUp, inviteUser);
router.patch('/:id', managerUp, updateUser);
router.delete('/:id', managerUp, removeUser);

export default router;
