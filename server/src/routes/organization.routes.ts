import { Router } from 'express';
import { requireAuth, adminOnly, directorUp } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  getOrganization,
  updateOrganization,
  onboardingStep1,
  onboardingStep2,
  onboardingGenerateWorkflow,
  completeOnboarding,
  addCustomField,
  removeCustomField,
  updateDealStages,
} from '../controllers/organization.controller';
import { onboardingStep1Schema, onboardingStep2Schema, updateOrganizationSchema, customFieldSchema } from '../validators/organization.validators';

const router = Router();
router.use(requireAuth);

router.get('/', getOrganization);
router.patch('/', directorUp, validateBody(updateOrganizationSchema), updateOrganization);

router.post('/onboarding/step-1', validateBody(onboardingStep1Schema), onboardingStep1);
router.post('/onboarding/step-2', validateBody(onboardingStep2Schema), onboardingStep2);
router.post('/onboarding/generate-workflow', onboardingGenerateWorkflow);
router.post('/onboarding/complete', completeOnboarding);

router.post('/custom-fields', directorUp, validateBody(customFieldSchema), addCustomField);
router.delete('/custom-fields/:fieldId', directorUp, removeCustomField);

router.put('/deal-stages', directorUp, updateDealStages);

export default router;
