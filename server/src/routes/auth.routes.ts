import { Router } from 'express';
import { signup, login, refresh, logout, me } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { signupSchema, loginSchema } from '../validators/auth.validators';
import { authLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/signup', authLimiter, validateBody(signupSchema), signup);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
