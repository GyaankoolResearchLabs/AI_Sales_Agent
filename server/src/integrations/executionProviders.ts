import { EmailProvider, WhatsAppProvider } from './types';
import { DevelopmentEmailProvider, DevelopmentWhatsAppProvider } from './development/developmentProviders';
import { SMTPEmailProvider } from './production/smtpProvider';
import { WhatsAppCloudProvider } from './production/whatsappProvider';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Provider selection for real approval-flow execution (Section 24/26 of the PRD):
 * purely env-credential-based, no per-organization "connected integration" gate —
 * that gate exists in factory.ts for the older /api/recommendations flow, which
 * this module deliberately does not touch. If SMTP/WhatsApp credentials are present
 * in env, the real provider is used; otherwise the dev provider is used automatically,
 * and which one was picked is always logged and returned to the caller so nothing
 * about what actually happened is ambiguous.
 */
export function resolveEmailExecutionProvider(): EmailProvider {
  if (env.smtpHost) {
    try {
      const provider = new SMTPEmailProvider();
      logger.info('Email execution provider: smtp (real credentials present)');
      return provider;
    } catch (err) {
      logger.warn('SMTP credentials present but provider construction failed — falling back to development provider', {
        error: (err as Error).message,
      });
    }
  }
  logger.info('Email execution provider: development (no SMTP_HOST configured)');
  return new DevelopmentEmailProvider();
}

export function resolveWhatsAppExecutionProvider(): WhatsAppProvider {
  if (env.whatsappAccessToken && env.whatsappPhoneNumberId) {
    try {
      const provider = new WhatsAppCloudProvider();
      logger.info('WhatsApp execution provider: whatsapp (real credentials present)');
      return provider;
    } catch (err) {
      logger.warn('WhatsApp credentials present but provider construction failed — falling back to development provider', {
        error: (err as Error).message,
      });
    }
  }
  logger.info('WhatsApp execution provider: development (no WHATSAPP_ACCESS_TOKEN configured)');
  return new DevelopmentWhatsAppProvider();
}
