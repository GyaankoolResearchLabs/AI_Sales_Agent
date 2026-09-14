export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
}
export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}
export interface EmailProvider {
  readonly name: string;
  readonly environment: 'production' | 'development';
  send(params: SendEmailParams): Promise<SendResult>;
}

export interface SendWhatsAppParams {
  fromNumber: string;
  toNumber: string;
  body: string;
}
export interface WhatsAppProvider {
  readonly name: string;
  readonly environment: 'production' | 'development';
  send(params: SendWhatsAppParams): Promise<SendResult>;
}

export interface PlaceCallParams {
  toNumber: string;
  fromNumber: string;
  purpose?: string;
}
export interface TelephonyProvider {
  readonly name: string;
  readonly environment: 'production' | 'development';
  placeCall(params: PlaceCallParams): Promise<SendResult>;
}

export interface CreateMeetingParams {
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
}
export interface CalendarProvider {
  readonly name: string;
  readonly environment: 'production' | 'development';
  createEvent(params: CreateMeetingParams): Promise<SendResult & { eventLink?: string }>;
}
