import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { DEFAULT_ACTIVITY_TYPES } from '../config/organizationDefaults';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { Industry, Prisma } from '@prisma/client';

const INCLUDE = { dealStages: true, activityTypes: true, customFields: true } as const;

// The frontend/legacy Mongoose data used the plain display string "Real Estate" as the
// Industry value; the Prisma enum member is RealEstate (mapped to that same display
// string in the database via @map). Translate at the boundary in both directions so
// callers never need to know about the enum-member-vs-@map distinction.
const INDUSTRY_DISPLAY_TO_ENUM: Record<string, Industry> = {
  SaaS: Industry.SaaS,
  'Real Estate': Industry.RealEstate,
  Consulting: Industry.Consulting,
  Manufacturing: Industry.Manufacturing,
  Other: Industry.Other,
};

function toIndustryEnum(value: unknown): Industry | undefined {
  if (typeof value !== 'string') return undefined;
  return INDUSTRY_DISPLAY_TO_ENUM[value];
}

const INDUSTRY_ENUM_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(INDUSTRY_DISPLAY_TO_ENUM).map(([display, enumValue]) => [enumValue, display])
);

/** Shapes a raw Prisma Organization row for the frontend: `_id` alias (Mongoose-shaped client types), and the Industry enum member translated back to its display string ("RealEstate" -> "Real Estate"). */
function toOrgResponse<T extends { id: string; industry: string }>(org: T): T & { _id: string } {
  return { ...org, _id: org.id, industry: INDUSTRY_ENUM_TO_DISPLAY[org.industry] ?? org.industry };
}

/** Whitelist + coerce the plain organization fields a client may update. Nested arrays (dealStages, etc.) are handled separately. */
function pickOrgFields(body: Record<string, unknown>): Prisma.OrganizationUpdateInput {
  const data: Prisma.OrganizationUpdateInput = {};
  if (typeof body.name === 'string') data.name = body.name;
  if (body.industry !== undefined) {
    const industry = toIndustryEnum(body.industry);
    if (industry) data.industry = industry;
  }
  if (typeof body.customIndustry === 'string') data.customIndustry = body.customIndustry;
  if (typeof body.businessModel === 'string') data.businessModel = body.businessModel as never;
  if (typeof body.companySize === 'string') data.companySize = body.companySize;
  if (typeof body.salesTeamSize === 'string') data.salesTeamSize = body.salesTeamSize;
  if (typeof body.productType === 'string') data.productType = body.productType;
  if (typeof body.averageDealSize === 'number') data.averageDealSize = body.averageDealSize;
  if (typeof body.salesCycleDays === 'number') data.salesCycleDays = body.salesCycleDays;
  if (Array.isArray(body.commonObjections)) data.commonObjections = body.commonObjections as string[];
  if (Array.isArray(body.qualificationCriteria)) data.qualificationCriteria = body.qualificationCriteria as string[];
  if (typeof body.ssoEnabled === 'boolean') data.ssoEnabled = body.ssoEnabled;
  if (Array.isArray(body.ipAllowlist)) data.ipAllowlist = body.ipAllowlist as string[];
  return data;
}

export const getOrganization = catchAsync(async (req: Request, res: Response) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId }, include: INCLUDE });
  if (!org) throw AppError.notFound('Organization not found');
  res.json({ success: true, data: toOrgResponse(org) });
});

export const updateOrganization = catchAsync(async (req: Request, res: Response) => {
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: pickOrgFields(req.body ?? {}),
    include: INCLUDE,
  });
  res.json({ success: true, data: toOrgResponse(org) });
});

export const onboardingStep1 = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Organization not found');
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { ...pickOrgFields(req.body ?? {}), onboardingStep: Math.max(existing.onboardingStep, 2) },
    include: INCLUDE,
  });
  res.json({ success: true, data: toOrgResponse(org) });
});

export const onboardingStep2 = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Organization not found');

  const { stages, ...rest } = req.body as { stages?: Array<{ key: string; label: string; order: number; probability: number; isWon?: boolean; isLost?: boolean }> };

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: req.user!.organizationId },
      data: { ...pickOrgFields(rest), onboardingStep: Math.max(existing.onboardingStep, 3) },
    });
    if (stages && stages.length > 0) {
      await tx.dealStageConfig.deleteMany({ where: { organizationId: req.user!.organizationId } });
      await tx.dealStageConfig.createMany({
        data: stages.map((s) => ({
          organizationId: req.user!.organizationId,
          key: s.key,
          label: s.label,
          order: s.order,
          probability: s.probability,
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
        })),
      });
    }
  });

  const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId }, include: INCLUDE });
  if (!org) throw AppError.notFound('Organization not found');
  res.json({ success: true, data: toOrgResponse(org) });
});

/** Step 3: auto-generate the sales workflow config from the answers gathered in steps 1-2. */
export const onboardingGenerateWorkflow = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, include: INCLUDE });
  if (!org) throw AppError.notFound('Organization not found');

  // Deal stages were already set/defaulted; ensure activity types + baseline custom fields exist.
  if (org.activityTypes.length === 0) {
    await prisma.activityTypeConfig.createMany({
      data: DEFAULT_ACTIVITY_TYPES.map((t) => ({ organizationId: orgId, key: t.key, label: t.label, icon: t.icon })),
    });
  }

  if (org.customFields.length === 0) {
    await prisma.customFieldConfig.createMany({
      data: [
        { organizationId: orgId, entity: 'deal', key: 'competitor', label: 'Competitor', type: 'text', required: false },
        { organizationId: orgId, entity: 'lead', key: 'budget', label: 'Budget confirmed', type: 'boolean', required: false },
      ],
    });
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingStep: Math.max(org.onboardingStep, 4) },
    include: INCLUDE,
  });

  await writeAuditLog({
    organization: orgId,
    actorType: 'system',
    action: 'organization.workflow_generated',
    entityType: 'Organization',
    entityId: orgId,
  });

  res.json({ success: true, data: toOrgResponse(updated) });
});

export const completeOnboarding = catchAsync(async (req: Request, res: Response) => {
  const org = await prisma.organization.update({
    where: { id: req.user!.organizationId },
    data: { onboardingCompleted: true, onboardingStep: 4 },
    include: INCLUDE,
  });
  res.json({ success: true, data: toOrgResponse(org) });
});

export const addCustomField = catchAsync(async (req: Request, res: Response) => {
  const { entity, key, label, type, options, required } = req.body as {
    entity: string;
    key: string;
    label: string;
    type: string;
    options?: string[];
    required?: boolean;
  };
  await prisma.customFieldConfig.create({
    data: {
      organizationId: req.user!.organizationId,
      entity: entity as never,
      key,
      label,
      type: type as never,
      options: options ?? [],
      required: required ?? false,
    },
  });
  const customFields = await prisma.customFieldConfig.findMany({ where: { organizationId: req.user!.organizationId } });
  res.status(201).json({ success: true, data: customFields });
});

export const removeCustomField = catchAsync(async (req: Request, res: Response) => {
  await prisma.customFieldConfig.deleteMany({ where: { id: req.params.fieldId, organizationId: req.user!.organizationId } });
  const customFields = await prisma.customFieldConfig.findMany({ where: { organizationId: req.user!.organizationId } });
  res.json({ success: true, data: customFields });
});

export const updateDealStages = catchAsync(async (req: Request, res: Response) => {
  const stages = req.body.stages as Array<{ key: string; label: string; order: number; probability: number; isWon?: boolean; isLost?: boolean }>;
  const orgId = req.user!.organizationId;
  await prisma.$transaction([
    prisma.dealStageConfig.deleteMany({ where: { organizationId: orgId } }),
    prisma.dealStageConfig.createMany({
      data: stages.map((s) => ({
        organizationId: orgId,
        key: s.key,
        label: s.label,
        order: s.order,
        probability: s.probability,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      })),
    }),
  ]);
  const dealStages = await prisma.dealStageConfig.findMany({ where: { organizationId: orgId }, orderBy: { order: 'asc' } });
  res.json({ success: true, data: dealStages });
});
