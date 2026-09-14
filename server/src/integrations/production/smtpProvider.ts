import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { EmailProvider, SendEmailParams, SendResult } from '../types';
import { logger } from '../../utils/logger';

/** Real SMTP email delivery — genuinely sends mail when SMTP_* env vars are configured. */
export class SMTPEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  readonly environment = 'production' as const;
  private transporter: Transporter;

  constructor() {
    if (!env.smtpHost) {
      throw new Error('SmtpProvider requires SMTP_HOST to be configured — refusing to construct a transport that would silently fail to send.');
    }
    this.transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort ? parseInt(env.smtpPort, 10) : 587,
      secure: false,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }

  async send(params: SendEmailParams): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({ from: params.from, to: params.to, subject: params.subject, text: params.body });
      return { success: true, providerMessageId: info.messageId };
    } catch (err) {
      logger.error('SMTP send failed', { error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }
}
