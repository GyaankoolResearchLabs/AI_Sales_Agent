import { prisma } from '../config/prisma';
import { EmailProvider, WhatsAppProvider, TelephonyProvider } from './types';
import { DevelopmentEmailProvider, DevelopmentWhatsAppProvider, DevelopmentTelephonyProvider } from './development/developmentProviders';
import { SMTPEmailProvider } from './production/smtpProvider';
import { GmailEmailProvider, OutlookEmailProvider } from './production/oauthEmailProviders';
import { WhatsAppCloudProvider } from './production/whatsappProvider';
import { TwilioTelephonyProvider, VonageTelephonyProvider } from './production/telephonyProviders';
import { env } from '../config/env';

/**
 * Resolves the active provider for an organization. An org only gets a
 * production provider if it has an Integration record with status
 * 'connected' for that category — otherwise it always falls back to the
 * clearly-labeled development adapter, so the UI never claims a live
 * integration that hasn't actually been connected.
 */
export async function resolveEmailProvider(orgId: string): Promise<EmailProvider> {
  const integration = await prisma.integration.findFirst({ where: { organizationId: orgId, category: 'email', status: 'connected' } });
  if (!integration) return new DevelopmentEmailProvider();
  switch (integration.provider) {
    case 'gmail':
      return new GmailEmailProvider();
    case 'outlook':
      return new OutlookEmailProvider();
    case 'smtp':
      return env.smtpHost ? new SMTPEmailProvider() : new DevelopmentEmailProvider();
    default:
      return new DevelopmentEmailProvider();
  }
}

export async function resolveWhatsAppProvider(orgId: string): Promise<WhatsAppProvider> {
  const integration = await prisma.integration.findFirst({ where: { organizationId: orgId, category: 'whatsapp', status: 'connected' } });
  if (!integration) return new DevelopmentWhatsAppProvider();
  return env.whatsappAccessToken ? new WhatsAppCloudProvider() : new DevelopmentWhatsAppProvider();
}

export async function resolveTelephonyProvider(orgId: string): Promise<TelephonyProvider> {
  const integration = await prisma.integration.findFirst({ where: { organizationId: orgId, category: 'telephony', status: 'connected' } });
  if (!integration) return new DevelopmentTelephonyProvider();
  switch (integration.provider) {
    case 'twilio':
      return new TwilioTelephonyProvider();
    case 'vonage':
      return new VonageTelephonyProvider();
    default:
      return new DevelopmentTelephonyProvider();
  }
}
