import { env } from '../../config/env';
import { WhatsAppProvider, SendWhatsAppParams, SendResult } from '../types';
import { logger } from '../../utils/logger';

/** Real WhatsApp Cloud API delivery when WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are configured. */
export class WhatsAppCloudProvider implements WhatsAppProvider {
  readonly name = 'whatsapp';
  readonly environment = 'production' as const;

  constructor() {
    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      throw new Error('WhatsAppCloudProvider requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID — refusing to construct without them.');
    }
  }

  async send(params: SendWhatsAppParams): Promise<SendResult> {
    try {
      const resp = await fetch(`https://graph.facebook.com/v20.0/${env.whatsappPhoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.whatsappAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: params.toNumber,
          type: 'text',
          text: { body: params.body },
        }),
      });
      const data = (await resp.json()) as { messages?: { id: string }[]; error?: { message: string } };
      if (!resp.ok) return { success: false, error: data.error?.message || 'WhatsApp API request failed' };
      return { success: true, providerMessageId: data.messages?.[0]?.id };
    } catch (err) {
      logger.error('WhatsApp send failed', { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }
}
