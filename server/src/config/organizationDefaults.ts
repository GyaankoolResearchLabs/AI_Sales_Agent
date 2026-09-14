/**
 * Plain default-data constants for a newly created Organization — deal stage
 * pipeline and activity type config. Pure data, no ORM dependency: used by
 * both the real signup flow (auth.controller.ts) and the demo seed script.
 */

export type Industry = 'SaaS' | 'Real Estate' | 'Consulting' | 'Manufacturing' | 'Other';
export type BusinessModel = 'B2B' | 'B2C' | 'B2B2C' | 'Marketplace' | 'Other';

export interface IDealStageConfig {
  key: string;
  label: string;
  order: number;
  probability: number; // 0-100, default probability for deals sitting in this stage
  isWon: boolean;
  isLost: boolean;
}

export interface IActivityTypeConfig {
  key: string;
  label: string;
  icon: string;
}

export interface ICustomFieldConfig {
  entity: 'lead' | 'contact' | 'company' | 'deal';
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required: boolean;
}

export const DEFAULT_DEAL_STAGES: IDealStageConfig[] = [
  { key: 'lead', label: 'Lead', order: 0, probability: 10, isWon: false, isLost: false },
  { key: 'qualified', label: 'Qualified', order: 1, probability: 25, isWon: false, isLost: false },
  { key: 'discovery', label: 'Discovery', order: 2, probability: 40, isWon: false, isLost: false },
  { key: 'proposal', label: 'Proposal', order: 3, probability: 60, isWon: false, isLost: false },
  { key: 'negotiation', label: 'Negotiation', order: 4, probability: 80, isWon: false, isLost: false },
  { key: 'won', label: 'Won', order: 5, probability: 100, isWon: true, isLost: false },
  { key: 'lost', label: 'Lost', order: 6, probability: 0, isWon: false, isLost: true },
];

export const DEFAULT_ACTIVITY_TYPES: IActivityTypeConfig[] = [
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'call', label: 'Call', icon: 'phone' },
  { key: 'meeting', label: 'Meeting', icon: 'calendar' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { key: 'note', label: 'Note', icon: 'file-text' },
  { key: 'task', label: 'Task', icon: 'check-square' },
];
