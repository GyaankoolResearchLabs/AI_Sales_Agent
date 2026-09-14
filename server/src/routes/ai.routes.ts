import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import {
  chat,
  generateEmail,
  generateWhatsApp,
  generateCallScript,
  generateProposal,
  analyzeDeal,
  summarizeConversation,
  runAnomalyDetection,
  forecast,
  recommendNextAction,
} from '../controllers/ai.controller';

const router = Router();
router.use(requireAuth, aiLimiter);

router.post('/chat', chat);
router.post('/generate/email', generateEmail);
router.post('/generate/whatsapp', generateWhatsApp);
router.post('/generate/call-script', generateCallScript);
router.post('/generate/proposal', generateProposal);
router.post('/deals/:dealId/analyze', analyzeDeal);
router.get('/deals/:dealId/summary', summarizeConversation);
router.post('/deals/:dealId/recommend', recommendNextAction);
router.post('/anomalies/run', runAnomalyDetection);
router.get('/forecast', forecast);

export default router;
