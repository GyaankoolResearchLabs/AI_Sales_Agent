export type UserRole = 'sales_rep' | 'sales_manager' | 'sales_director' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  avatarColor?: string;
}

export interface DealStageConfig {
  _id?: string;
  key: string;
  label: string;
  order: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
}

export interface ActivityTypeConfig {
  key: string;
  label: string;
  icon: string;
}

export interface CustomFieldConfig {
  _id?: string;
  entity: 'lead' | 'contact' | 'company' | 'deal';
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  required: boolean;
}

export interface Organization {
  _id: string;
  name: string;
  industry: string;
  customIndustry?: string;
  businessModel: string;
  companySize: string;
  salesTeamSize: string;
  productType: string;
  averageDealSize?: number;
  salesCycleDays?: number;
  commonObjections?: string[];
  qualificationCriteria?: string[];
  onboardingCompleted: boolean;
  onboardingStep: number;
  dealStages: DealStageConfig[];
  activityTypes: ActivityTypeConfig[];
  customFields: CustomFieldConfig[];
  ssoEnabled?: boolean;
  ipAllowlist?: string[];
}

export interface RefLite {
  _id: string;
  name: string;
}

export interface Lead {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
  source?: string;
  status: 'new' | 'contacted' | 'qualifying' | 'qualified' | 'disqualified' | 'converted';
  score: number;
  scoreBreakdown?: Record<string, number>;
  owner?: RefLite;
  notes?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: RefLite;
  jobTitle?: string;
  owner?: RefLite;
  source?: string;
  tags: string[];
  isDecisionMaker: boolean;
  createdAt: string;
}

export interface Company {
  _id: string;
  name: string;
  industry?: string;
  website?: string;
  employees?: number;
  location?: string;
  notes?: string;
  owner?: RefLite;
  createdAt: string;
}

export interface DealScoreFactor {
  key: string;
  label: string;
  weight: number;
  contribution: number;
  detail: string;
}

export interface DealScore {
  probability: number;
  health: 'healthy' | 'at_risk' | 'stalled' | 'unknown';
  factors: DealScoreFactor[];
  explanation: string;
  recommendation: string;
  calculatedAt: string;
}

export interface Deal {
  _id: string;
  name: string;
  company?: RefLite;
  primaryContact?: { _id: string; name: string; email?: string; phone?: string; isDecisionMaker?: boolean };
  owner: RefLite;
  value: number;
  currency: string;
  stageKey: string;
  probability: number;
  expectedCloseDate?: string;
  source?: string;
  aiScore?: DealScore;
  lastActivityAt?: string;
  wonAt?: string;
  lostAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  _id: string;
  type: 'email' | 'call' | 'meeting' | 'whatsapp' | 'note' | 'task';
  subject: string;
  body?: string;
  deal?: string;
  lead?: string;
  contact?: string;
  owner: RefLite;
  isCompleted: boolean;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  channel: 'email' | 'whatsapp' | 'call' | 'meeting' | 'note';
  deal?: string;
  participant: string;
  content: string;
  direction: 'inbound' | 'outbound';
  sentiment?: 'positive' | 'neutral' | 'negative';
  aiSummary?: string;
  occurredAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  deal?: string;
  assignedTo: RefLite;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  createdByAI: boolean;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  isActive: boolean;
}

export interface AIInsight {
  _id: string;
  deal?: { _id: string; name: string; value?: number };
  lead?: { _id: string; name: string };
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface AIRecommendation {
  _id: string;
  deal?: { _id: string; name: string; value?: number };
  targetUser?: RefLite;
  action: string;
  channel?: string;
  title: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
  generatedContent?: { subject?: string; body?: string };
  permissionRequirement: 'allowed' | 'approval_required';
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
  createdAt: string;
}

export interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  _id: string;
  actorType: 'user' | 'ai_agent' | 'system';
  actor?: RefLite;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  approvalRequired: boolean;
  approvedBy?: RefLite;
  createdAt: string;
}

export type AutonomyLevel = 1 | 2 | 3 | 4;
export type PermissionMode = 'allowed' | 'approval_required' | 'disabled';

export interface AutonomySettings {
  _id: string;
  level: AutonomyLevel;
  permissions: {
    emailSending: PermissionMode;
    whatsappSending: PermissionMode;
    crmUpdates: PermissionMode;
    meetingScheduling: PermissionMode;
    proposalCreation: PermissionMode;
    taskCreation: PermissionMode;
  };
}

export interface HotLeadItem {
  leadId: string;
  name: string;
  companyName?: string;
  score: number;
  priority: 'medium' | 'high' | 'urgent';
  reason: string;
}

export interface DueFollowUpItem {
  activityId: string;
  subject: string;
  type: string;
  dealId?: string;
  scheduledAt: string;
  priority: 'medium' | 'high' | 'urgent';
  reason: string;
}

export interface AtRiskDealItem {
  dealId: string;
  dealName: string;
  customer?: string;
  value: number;
  lastActivityAt: string | null;
  daysSinceActivity: number;
  priority: 'medium' | 'high' | 'urgent';
  reason: string;
}

export interface PipelineStageHealth {
  stageKey: string;
  label: string;
  count: number;
  value: number;
}

export interface DailyBriefing {
  greetingName: string;
  generatedAt: string;
  hotLeads: HotLeadItem[];
  dueFollowUps: DueFollowUpItem[];
  atRiskDeals: AtRiskDealItem[];
  pipelineHealth: { byStage: PipelineStageHealth[]; totalOpenValue: number; openDealCount: number };
}

export interface Integration {
  provider: string;
  category: string;
  environment: 'production' | 'development';
  status: 'not_connected' | 'connected' | 'error';
  hasProductionCredentials?: boolean;
  connectedAt?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: { label: string; type: string; payload?: Record<string, unknown> }[];
}
