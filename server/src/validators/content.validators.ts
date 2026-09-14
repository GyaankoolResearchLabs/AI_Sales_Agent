import { z } from 'zod';

export const contentRequestSchema = z.object({
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  purpose: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'concise']).optional(),
  reason: z.string().optional(),
});

export const proposalRequestSchema = z.object({
  dealId: z.string(),
  section: z.enum(['executive_summary', 'scope', 'pricing', 'timeline', 'why_us']).optional(),
});
