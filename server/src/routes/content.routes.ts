import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { contentRequestSchema, proposalRequestSchema } from '../validators/content.validators';
import {
  createEmailDraft,
  createWhatsAppDraft,
  createCallScriptDraft,
  createProposalDraft,
  regenerateDraft,
  getDraft,
  listDrafts,
} from '../controllers/content.controller';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(requireAuth, aiLimiter);

router.get('/', listDrafts);
router.post('/email', validateBody(contentRequestSchema), createEmailDraft);
router.post('/whatsapp', validateBody(contentRequestSchema), createWhatsAppDraft);
router.post('/call-script', validateBody(contentRequestSchema), createCallScriptDraft);
router.post('/proposal', validateBody(proposalRequestSchema), createProposalDraft);
router.get('/:id', getDraft);
router.post('/:id/regenerate', regenerateDraft);

export default router;
