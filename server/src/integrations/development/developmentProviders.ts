import crypto from 'crypto';
import { logger } from '../../utils/logger';
import {
  EmailProvider,
  WhatsAppProvider,
  TelephonyProvider,
  CalendarProvider,
  SendEmailParams,
  SendWhatsAppParams,
  PlaceCallParams,
  CreateMeetingParams,
  SendResult,
} from '../types';

/**
 * Development adapters: they perform the real side effect available in a
 * dev environment (structured logging + a deterministic id) but never
 * claim to have reached Gmail/WhatsApp/Twilio. Every record they produce is
 * tagged environment: 'development' so the UI can show it honestly instead
 * of pretending a production integration succeeded.
 */
export class DevelopmentEmailProvider implements EmailProvider {
  readonly name = 'development';
  readonly environment = 'development' as const;
  async send(params: SendEmailParams): Promise<SendResult> {
    const id = `dev_email_${crypto.randomUUID()}`;
    logger.info('[dev-email] would send email', { to: params.to, subject: params.subject, id });
    return { success: true, providerMessageId: id };
  }
}

export class DevelopmentWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'development';
  readonly environment = 'development' as const;
  async send(params: SendWhatsAppParams): Promise<SendResult> {
    const id = `dev_wa_${crypto.randomUUID()}`;
    logger.info('[dev-whatsapp] would send message', { to: params.toNumber, id });
    return { success: true, providerMessageId: id };
  }
}

export class DevelopmentTelephonyProvider implements TelephonyProvider {
  readonly name = 'development';
  readonly environment = 'development' as const;
  async placeCall(params: PlaceCallParams): Promise<SendResult> {
    const id = `dev_call_${crypto.randomUUID()}`;
    logger.info('[dev-telephony] would place call', { to: params.toNumber, id });
    return { success: true, providerMessageId: id };
  }
}

export class DevelopmentCalendarProvider implements CalendarProvider {
  readonly name = 'development';
  readonly environment = 'development' as const;
  async createEvent(params: CreateMeetingParams): Promise<SendResult & { eventLink?: string }> {
    const id = `dev_event_${crypto.randomUUID()}`;
    logger.info('[dev-calendar] would create event', { title: params.title, id });
    return { success: true, providerMessageId: id, eventLink: undefined };
  }
}
