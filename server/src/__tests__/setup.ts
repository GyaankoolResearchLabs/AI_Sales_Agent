import { prisma } from '../config/prisma';

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.AI_PROVIDER = 'local';

beforeAll(async () => {
  // One-time safety net: earlier runs against this real, shared Supabase project can leave
  // rows behind — e.g. a fixed test email that now collides with a fresh signup attempt.
  // Wipe it clean before this run starts too, not just between tests.
  await prisma.organization.deleteMany({});
}, 30000);

afterEach(async () => {
  // Real Supabase/Postgres via Prisma — deleting Organization cascades every child row
  // (Users, DealStageConfig, ActivityTypeConfig, CustomFieldConfig, AutonomySettings,
  // AuditLog, Integration, Leads, Contacts, Companies, Deals, Activities, Conversations,
  // Tasks, ContentDrafts, AIInsights, AIRecommendations, Approvals, Emails, Messages,
  // Meetings, Reports, Notifications, and RefreshTokens via User). This is a *shared* real
  // database, so every test run must leave it exactly as it found it.
  await prisma.organization.deleteMany({});
}, 30000);

afterAll(async () => {
  await prisma.$disconnect();
}, 30000);
