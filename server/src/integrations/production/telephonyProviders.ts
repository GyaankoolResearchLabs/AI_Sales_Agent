import { env } from '../../config/env';
import { TelephonyProvider, PlaceCallParams, SendResult } from '../types';
import { logger } from '../../utils/logger';

/** Real Twilio call placement when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are configured. */
export class TwilioTelephonyProvider implements TelephonyProvider {
  readonly name = 'twilio';
  readonly environment = 'production' as const;

  async placeCall(params: PlaceCallParams): Promise<SendResult> {
    if (!env.twilioAccountSid || !env.twilioAuthToken) {
      return { success: false, error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN and connect it from Settings > Integrations.' };
    }
    try {
      const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Calls.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: params.toNumber, From: params.fromNumber, Url: 'http://demo.twilio.com/docs/voice.xml' }),
      });
      const data = (await resp.json()) as { sid?: string; message?: string };
      if (!resp.ok) return { success: false, error: data.message || 'Twilio API request failed' };
      return { success: true, providerMessageId: data.sid };
    } catch (err) {
      logger.error('Twilio call failed', { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }
}

/** Vonage is scaffolded as a provider-abstraction target; wire VONAGE_API_KEY/SECRET to activate. */
export class VonageTelephonyProvider implements TelephonyProvider {
  readonly name = 'vonage';
  readonly environment = 'production' as const;
  async placeCall(_params: PlaceCallParams): Promise<SendResult> {
    return { success: false, error: 'Vonage is not configured. Set VONAGE_API_KEY / VONAGE_API_SECRET and connect it from Settings > Integrations.' };
  }
}
