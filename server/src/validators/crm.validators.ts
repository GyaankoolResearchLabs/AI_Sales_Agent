import { z } from 'zod';

export const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualifying', 'qualified', 'disqualified', 'converted']).optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  owner: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isDecisionMaker: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const companySchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  website: z.string().optional(),
  employees: z.number().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  owner: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const dealSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  primaryContact: z.string().optional(),
  owner: z.string().optional(),
  value: z.number().nonnegative(),
  currency: z.string().optional(),
  stageKey: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  source: z.string().optional(),
  products: z
    .array(z.object({ product: z.string(), quantity: z.number().default(1), price: z.number().default(0) }))
    .optional(),
  notes: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const activitySchema = z.object({
  type: z.enum(['email', 'call', 'meeting', 'whatsapp', 'note', 'task']),
  subject: z.string().min(1),
  body: z.string().optional(),
  deal: z.string().optional(),
  lead: z.string().optional(),
  contact: z.string().optional(),
  company: z.string().optional(),
  assignedTo: z.string().optional(),
  scheduledAt: z.string().optional(),
  isCompleted: z.boolean().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  deal: z.string().optional(),
  lead: z.string().optional(),
  contact: z.string().optional(),
  assignedTo: z.string(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
});

export const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  sku: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const conversationSchema = z.object({
  channel: z.enum(['email', 'whatsapp', 'call', 'meeting', 'note']),
  deal: z.string().optional(),
  contact: z.string().optional(),
  lead: z.string().optional(),
  participant: z.string().min(1),
  content: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  occurredAt: z.string().optional(),
});
