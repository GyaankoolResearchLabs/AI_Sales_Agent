import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { EmailProvider, SendEmailParams, SendResult } from '../types';

/**
 * Gmail / Outlook require a completed OAuth consent flow (authorization
 * code exchanged for a refresh token) which cannot be performed headlessly.
 * These classes are real integration points — wire the token exchange in
 * `/api/integrations/:provider/callback` — but until GOOGLE_CLIENT_ID/
 * MICROSOFT_CLIENT_ID are configured AND a user has completed OAuth, they
 * refuse to pretend the integration is connected.
 */
export class GmailEmailProvider implements EmailProvider {
  readonly name = 'gmail';
  readonly environment = 'production' as const;
  async send(_params: SendEmailParams): Promise<SendResult> {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw AppError.badRequest('Gmail is not configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and connect Gmail from Settings > Integrations.');
    }
    throw AppError.badRequest('Gmail OAuth has not been completed for this organization yet. Connect it from Settings > Integrations.');
  }
}

export class OutlookEmailProvider implements EmailProvider {
  readonly name = 'outlook';
  readonly environment = 'production' as const;
  async send(_params: SendEmailParams): Promise<SendResult> {
    if (!env.microsoftClientId || !env.microsoftClientSecret) {
      throw AppError.badRequest('Outlook is not configured. Set MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET and connect Outlook from Settings > Integrations.');
    }
    throw AppError.badRequest('Outlook OAuth has not been completed for this organization yet. Connect it from Settings > Integrations.');
  }
}
