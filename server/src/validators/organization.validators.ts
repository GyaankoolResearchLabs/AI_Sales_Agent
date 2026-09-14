import { z } from 'zod';

export const onboardingStep1Schema = z.object({
  industry: z.enum(['SaaS', 'Real Estate', 'Consulting', 'Manufacturing', 'Other']),
  customIndustry: z.string().optional(),
  businessModel: z.enum(['B2B', 'B2C', 'B2B2C', 'Marketplace', 'Other']),
  companySize: z.string(),
  salesTeamSize: z.string(),
  productType: z.string(),
});

export const onboardingStep2Schema = z.object({
  averageDealSize: z.number().nonnegative().optional(),
  salesCycleDays: z.number().nonnegative().optional(),
  commonObjections: z.array(z.string()).optional(),
  qualificationCriteria: z.array(z.string()).optional(),
  stages: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        order: z.number(),
        probability: z.number().min(0).max(100),
        isWon: z.boolean().optional(),
        isLost: z.boolean().optional(),
      })
    )
    .optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  industry: z.enum(['SaaS', 'Real Estate', 'Consulting', 'Manufacturing', 'Other']).optional(),
  customIndustry: z.string().optional(),
  businessModel: z.enum(['B2B', 'B2C', 'B2B2C', 'Marketplace', 'Other']).optional(),
  companySize: z.string().optional(),
  salesTeamSize: z.string().optional(),
  productType: z.string().optional(),
});

export const customFieldSchema = z.object({
  entity: z.enum(['lead', 'contact', 'company', 'deal']),
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});
