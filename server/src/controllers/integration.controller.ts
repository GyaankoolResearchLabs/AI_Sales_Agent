import { Request, Response } from 'express';
import { IntegrationProvider, IntegrationCategory } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';

const PROVIDER_CATEGORY: Record<IntegrationProvider, IntegrationCategory> = {
  gmail: 'email',
  outlook: 'email',
  smtp: 'email',
  google_calendar: 'calendar',
  outlook_calendar: 'calendar',
  whatsapp: 'whatsapp',
  twilio: 'telephony',
  vonage: 'telephony',
  salesforce: 'crm_import',
  hubspot: 'crm_import',
  pipedrive: 'crm_import',
};

const PROVIDER_HAS_PRODUCTION_CREDS: Record<IntegrationProvider, boolean> = {
  gmail: Boolean(env.googleClientId && env.googleClientSecret),
  outlook: Boolean(env.microsoftClientId && env.microsoftClientSecret),
  smtp: Boolean(env.smtpHost),
  google_calendar: Boolean(env.googleClientId && env.googleClientSecret),
  outlook_calendar: Boolean(env.microsoftClientId && env.microsoftClientSecret),
  whatsapp: Boolean(env.whatsappAccessToken),
  twilio: Boolean(env.twilioAccountSid && env.twilioAuthToken),
  vonage: false,
  salesforce: false,
  hubspot: false,
  pipedrive: false,
};

function toResponse(i: { id: string; organizationId: string; provider: string; category: string; environment: string; status: string; connectedById: string | null; connectedAt: Date | null; config: unknown }) {
  return {
    _id: i.id,
    organization: i.organizationId,
    provider: i.provider,
    category: i.category,
    environment: i.environment,
    status: i.status,
    connectedBy: i.connectedById ?? undefined,
    connectedAt: i.connectedAt ?? undefined,
    config: i.config,
  };
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.integration.findMany({ where: { organizationId: orgId } });
  const byProvider = new Map(existing.map((i) => [i.provider, toResponse(i)]));

  const all = (Object.keys(PROVIDER_CATEGORY) as IntegrationProvider[]).map((provider) => {
    const record = byProvider.get(provider);
    return (
      record ?? {
        organization: orgId,
        provider,
        category: PROVIDER_CATEGORY[provider],
        environment: PROVIDER_HAS_PRODUCTION_CREDS[provider] ? 'production' : 'development',
        status: 'not_connected',
        config: {},
      }
    );
  });

  res.json({ success: true, data: all.map((i) => ({ ...i, hasProductionCredentials: PROVIDER_HAS_PRODUCTION_CREDS[i.provider as IntegrationProvider] })) });
});

/**
 * Connects an integration. If production credentials are configured for the
 * provider, this activates the production adapter; otherwise it activates
 * the development adapter and is labeled as such — it never claims a live
 * connection it doesn't have.
 */
export const connect = catchAsync(async (req: Request, res: Response) => {
  const provider = req.params.provider as IntegrationProvider;
  if (!PROVIDER_CATEGORY[provider]) throw AppError.badRequest('Unknown integration provider');

  const hasProd = PROVIDER_HAS_PRODUCTION_CREDS[provider];
  if (!hasProd && ['gmail', 'outlook'].includes(provider)) {
    throw AppError.badRequest(`${provider} requires completing OAuth consent, which needs GOOGLE_CLIENT_ID/MICROSOFT_CLIENT_ID configured. Connecting in development mode instead is not applicable for OAuth-only providers — configure credentials first.`);
  }

  const integration = await prisma.integration.upsert({
    where: { organizationId_provider: { organizationId: req.user!.organizationId, provider } },
    create: {
      organizationId: req.user!.organizationId,
      provider,
      category: PROVIDER_CATEGORY[provider],
      environment: hasProd ? 'production' : 'development',
      status: 'connected',
      connectedById: req.user!.id,
      connectedAt: new Date(),
    },
    update: {
      category: PROVIDER_CATEGORY[provider],
      environment: hasProd ? 'production' : 'development',
      status: 'connected',
      connectedById: req.user!.id,
      connectedAt: new Date(),
    },
  });

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'integration.connected',
    entityType: 'Integration',
    entityId: integration.id,
    metadata: { provider, environment: integration.environment },
  });

  res.json({ success: true, data: toResponse(integration) });
});

export const disconnect = catchAsync(async (req: Request, res: Response) => {
  const provider = req.params.provider as IntegrationProvider;
  const existing = await prisma.integration.findFirst({ where: { organizationId: req.user!.organizationId, provider } });
  if (!existing) throw AppError.notFound('Integration not found');
  const integration = await prisma.integration.update({
    where: { id: existing.id },
    data: { status: 'not_connected', connectedById: null, connectedAt: null },
  });
  res.json({ success: true, data: toResponse(integration) });
});
