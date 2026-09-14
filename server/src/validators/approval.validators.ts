import { z } from 'zod';

export const createApprovalSchema = z.object({
  dealId: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  contentDraftId: z.string().optional(),
  title: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(100).optional(),
  permissionCategory: z.enum(['emailSending', 'whatsappSending', 'crmUpdates', 'meetingScheduling', 'proposalCreation', 'taskCreation']),
});

export const rejectApprovalSchema = z.object({
  reason: z.string().min(1),
});
