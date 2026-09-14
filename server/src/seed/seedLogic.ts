import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { DEFAULT_DEAL_STAGES, DEFAULT_ACTIVITY_TYPES } from '../config/organizationDefaults';
import { scoreAndSaveDeal } from '../ai/dealScoring.service';
import { scoreAndSaveLead } from '../ai/leadScoring.service';
import { detectAnomalies } from '../ai/anomalyDetection.service';
import { prisma } from '../config/prisma';

const DAY_MS = 86400000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

export async function runSeed() {
  logger.info('Seeding demo organization — clearly a demo environment, not production data...');

  const existing = await prisma.organization.findFirst({ where: { name: 'Northwind Analytics (Demo)' } });
  if (existing) {
    const orgId = existing.id;
    // Prisma cascade-deletes users, deal stages, activity types, custom fields, AutonomySettings,
    // companies, contacts, leads, products, deals (+ deal_products), activities, conversations,
    // tasks, content drafts, ai insights/recommendations, approvals, emails, messages,
    // meetings, reports, and integrations.
    await prisma.organization.delete({ where: { id: orgId } });
  }

  const org = await prisma.organization.create({
    data: {
      name: 'Northwind Analytics (Demo)',
      industry: 'SaaS',
      businessModel: 'B2B',
      companySize: '51-200',
      salesTeamSize: '6-10',
      productType: 'Subscription analytics platform',
      averageDealSize: 32000,
      salesCycleDays: 45,
      commonObjections: ['The price is too high', 'We need to think about it', 'We are happy with our current solution'],
      qualificationCriteria: ['Budget confirmed', 'Decision maker identified', 'Timeline within 2 quarters'],
      onboardingCompleted: true,
      onboardingStep: 4,
      dealStages: { create: DEFAULT_DEAL_STAGES.map(({ key, label, order, probability, isWon, isLost }) => ({ key, label, order, probability, isWon, isLost })) },
      activityTypes: { create: DEFAULT_ACTIVITY_TYPES.map(({ key, label, icon }) => ({ key, label, icon })) },
      customFields: { create: [{ entity: 'deal', key: 'competitor', label: 'Competitor', type: 'text', required: false }] },
      // Real AutonomySettings row (Prisma is the single real store now, same as every
      // signup via auth.controller.ts).
      autonomySettings: {
        create: {
          level: 2,
          emailSending: 'approval_required',
          whatsappSending: 'approval_required',
          crmUpdates: 'allowed',
          meetingScheduling: 'approval_required',
          proposalCreation: 'allowed',
          taskCreation: 'allowed',
        },
      },
      integrations: {
        create: (['gmail', 'outlook', 'smtp', 'google_calendar', 'outlook_calendar', 'whatsapp', 'twilio', 'vonage'] as const).map((provider) => ({
          provider,
          category: provider.includes('calendar') ? 'calendar' : provider === 'whatsapp' ? 'whatsapp' : provider === 'twilio' || provider === 'vonage' ? 'telephony' : 'email',
          environment: 'development',
          status: 'not_connected',
        })),
      },
    },
  });
  const orgId = org.id;

  const passwordHash = await bcrypt.hash('Demo123!', 12);
  const [priya, marcus, elena, admin] = await Promise.all([
    prisma.user.create({ data: { organizationId: orgId, name: 'Priya Sharma', email: 'priya@northwind.demo', passwordHash, role: 'sales_rep', title: 'Account Executive', avatarColor: '#6366f1' } }),
    prisma.user.create({ data: { organizationId: orgId, name: 'Marcus Chen', email: 'marcus@northwind.demo', passwordHash, role: 'sales_rep', title: 'Account Executive', avatarColor: '#059669' } }),
    prisma.user.create({ data: { organizationId: orgId, name: 'Elena Rodriguez', email: 'elena@northwind.demo', passwordHash, role: 'sales_manager', title: 'Sales Manager', avatarColor: '#d97706' } }),
    prisma.user.create({ data: { organizationId: orgId, name: 'Sam Okafor', email: 'admin@northwind.demo', passwordHash, role: 'admin', title: 'Founder', avatarColor: '#dc2626' } }),
  ]);

  const products = await Promise.all(
    [
      { name: 'Analytics Core', price: 12000, description: 'Core analytics platform, annual license' },
      { name: 'Advanced Insights Add-on', price: 8000, description: 'AI-powered forecasting module' },
      { name: 'Enterprise Support', price: 6000, description: 'Dedicated support & SLA' },
    ].map((p) => prisma.product.create({ data: { ...p, organizationId: orgId } }))
  );

  const companyDefs = [
    { name: 'Acme Corp', industry: 'Manufacturing', website: 'acme.example.com', employees: 850, location: 'Austin, TX' },
    { name: 'Globex Retail', industry: 'Retail', website: 'globex.example.com', employees: 3200, location: 'Chicago, IL' },
    { name: 'Initech Software', industry: 'SaaS', website: 'initech.example.com', employees: 210, location: 'San Francisco, CA' },
    { name: 'Umbrella Health', industry: 'Healthcare', website: 'umbrella.example.com', employees: 4100, location: 'Boston, MA' },
    { name: 'Stark Manufacturing', industry: 'Manufacturing', website: 'starkmfg.example.com', employees: 1500, location: 'Detroit, MI' },
    { name: 'Wayne Consulting', industry: 'Consulting', website: 'wayneco.example.com', employees: 90, location: 'New York, NY' },
  ];
  const companies = await Promise.all(
    companyDefs.map((c) => prisma.company.create({ data: { ...c, organizationId: orgId, ownerId: priya.id, createdById: priya.id } }))
  );

  const contactDefs = [
    { name: 'Jordan Lee', email: 'jordan.lee@acme.example.com', phone: '+1-512-555-0101', companyId: companies[0].id, jobTitle: 'VP Operations', isDecisionMaker: true, ownerId: priya.id },
    { name: 'Taylor Kim', email: 'taylor.kim@globex.example.com', phone: '+1-312-555-0102', companyId: companies[1].id, jobTitle: 'Director of Analytics', isDecisionMaker: true, ownerId: marcus.id },
    { name: 'Morgan Patel', email: 'morgan.patel@initech.example.com', phone: '+1-415-555-0103', companyId: companies[2].id, jobTitle: 'Head of Product', isDecisionMaker: false, ownerId: priya.id },
    { name: 'Casey Novak', email: 'casey.novak@umbrella.example.com', phone: '+1-617-555-0104', companyId: companies[3].id, jobTitle: 'CFO', isDecisionMaker: true, ownerId: marcus.id },
    { name: 'Riley Brooks', email: 'riley.brooks@starkmfg.example.com', phone: '+1-313-555-0105', companyId: companies[4].id, jobTitle: 'Procurement Lead', isDecisionMaker: false, ownerId: priya.id },
    { name: 'Sasha Green', email: 'sasha.green@wayneco.example.com', phone: '+1-212-555-0106', companyId: companies[5].id, jobTitle: 'Managing Partner', isDecisionMaker: true, ownerId: marcus.id },
  ];
  const contacts = await Promise.all(
    contactDefs.map((c) => prisma.contact.create({ data: { ...c, organizationId: orgId, source: 'referral', createdById: priya.id } }))
  );

  // --- Deals with deliberately varied recency/engagement so scoring & anomaly detection produce a realistic spread ---
  const dealDefs = [
    { name: 'Acme Corp — Enterprise Rollout', companyId: companies[0].id, primaryContactId: contacts[0].id, ownerId: priya.id, value: 84000, stageKey: 'negotiation', lastActivityDays: 9 },
    { name: 'Globex Retail — Analytics Suite', companyId: companies[1].id, primaryContactId: contacts[1].id, ownerId: marcus.id, value: 45000, stageKey: 'proposal', lastActivityDays: 1 },
    { name: 'Initech — Core Platform', companyId: companies[2].id, primaryContactId: contacts[2].id, ownerId: priya.id, value: 18000, stageKey: 'discovery', lastActivityDays: 3 },
    { name: 'Umbrella Health — Enterprise', companyId: companies[3].id, primaryContactId: contacts[3].id, ownerId: marcus.id, value: 120000, stageKey: 'proposal', lastActivityDays: 12 },
    { name: 'Stark Manufacturing — Pilot', companyId: companies[4].id, primaryContactId: contacts[4].id, ownerId: priya.id, value: 26000, stageKey: 'qualified', lastActivityDays: 25 },
    { name: 'Wayne Consulting — Renewal Expansion', companyId: companies[5].id, primaryContactId: contacts[5].id, ownerId: marcus.id, value: 32000, stageKey: 'negotiation', lastActivityDays: 0 },
    { name: 'Acme Corp — Add-on Module', companyId: companies[0].id, primaryContactId: contacts[0].id, ownerId: priya.id, value: 15000, stageKey: 'lead', lastActivityDays: 2 },
    { name: 'Globex Retail — Support Renewal', companyId: companies[1].id, primaryContactId: contacts[1].id, ownerId: marcus.id, value: 22000, stageKey: 'won', lastActivityDays: 40 },
    { name: 'Initech — Legacy Migration', companyId: companies[2].id, primaryContactId: contacts[2].id, ownerId: priya.id, value: 9000, stageKey: 'lost', lastActivityDays: 60 },
  ];

  const deals = [];
  for (const d of dealDefs) {
    const deal = await prisma.deal.create({
      data: {
        organizationId: orgId,
        name: d.name,
        companyId: d.companyId,
        primaryContactId: d.primaryContactId,
        ownerId: d.ownerId,
        value: d.value,
        stageKey: d.stageKey,
        products: { create: [{ productId: products[0].id, quantity: 1, price: products[0].price }] },
        source: 'inbound',
        expectedCloseDate: daysAgo(-30),
        lastActivityAt: daysAgo(d.lastActivityDays),
        createdById: d.ownerId,
        wonAt: d.stageKey === 'won' ? daysAgo(d.lastActivityDays) : undefined,
        lostAt: d.stageKey === 'lost' ? daysAgo(d.lastActivityDays) : undefined,
      },
    });
    deals.push(deal);
  }

  // Activities & conversations calibrated to trigger the anomaly rules (Section 14).
  for (const deal of deals) {
    await prisma.activity.create({
      data: {
        organizationId: orgId,
        type: 'email',
        subject: `Follow-up: ${deal.name}`,
        dealId: deal.id,
        ownerId: deal.ownerId,
        isCompleted: true,
        direction: 'outbound',
        createdById: deal.ownerId,
        createdAt: deal.lastActivityAt ?? undefined,
        completedAt: deal.lastActivityAt,
      },
    });

    if (deal.name.includes('Acme Corp — Enterprise')) {
      // Proposal viewed 3x -> should trigger proposal_viewed_multiple insight
      for (let i = 0; i < 3; i++) {
        await prisma.conversation.create({
          data: {
            organizationId: orgId,
            channel: 'email',
            dealId: deal.id,
            contactId: deal.primaryContactId,
            participant: 'Jordan Lee',
            content: `Reviewed the proposal document again, still discussing internally. (view ${i + 1})`,
            direction: 'inbound',
            occurredAt: daysAgo(10 - i * 2),
            createdById: deal.ownerId,
          },
        });
      }
    }

    if (deal.name.includes('Wayne Consulting')) {
      // Decision maker engaged yesterday -> should trigger decision_maker_engaged insight
      await prisma.conversation.create({
        data: {
          organizationId: orgId,
          channel: 'call',
          dealId: deal.id,
          contactId: deal.primaryContactId,
          participant: 'Sasha Green',
          content: 'Great call — ready to move forward pending final sign-off.',
          direction: 'inbound',
          sentiment: 'positive',
          occurredAt: daysAgo(1),
          createdById: deal.ownerId,
        },
      });
    }

    if (deal.name.includes('Globex Retail — Analytics')) {
      await prisma.conversation.create({
        data: {
          organizationId: orgId,
          channel: 'email',
          dealId: deal.id,
          contactId: deal.primaryContactId,
          participant: 'Taylor Kim',
          content: 'Thanks for the proposal — a couple of questions on pricing tiers.',
          direction: 'inbound',
          sentiment: 'positive',
          occurredAt: daysAgo(1),
          createdById: deal.ownerId,
        },
      });
    }

    await scoreAndSaveDeal(deal.id, orgId);
  }

  // Leads with varied scores/status
  const leadDefs = [
    { name: 'Devon Ashford', email: 'devon.ashford@brightpath.example.com', companyName: 'BrightPath Inc', status: 'qualified', ownerId: priya.id, lastActivityDays: 1 },
    { name: 'Harper Quinn', email: 'harper.quinn@lumenworks.example.com', companyName: 'Lumen Works', status: 'contacted', ownerId: marcus.id, lastActivityDays: 4 },
    { name: 'Skyler Voss', email: 'skyler.voss@nexbridge.example.com', companyName: 'NexBridge', status: 'new', ownerId: priya.id, lastActivityDays: 20 },
    { name: 'ReeseTon', email: 'reese.ton@parallax.example.com', companyName: 'Parallax Data', status: 'qualifying', ownerId: marcus.id, lastActivityDays: 2 },
    { name: 'Emerson Cole', email: 'emerson.cole@brightpath.example.com', companyName: 'BrightPath Inc', status: 'qualified', ownerId: priya.id, lastActivityDays: 0 },
  ];
  for (const l of leadDefs) {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        name: l.name,
        email: l.email,
        companyName: l.companyName,
        status: l.status as never,
        ownerId: l.ownerId,
        source: 'inbound',
        lastActivityAt: daysAgo(l.lastActivityDays),
        createdById: l.ownerId,
      },
    });
    if (l.lastActivityDays <= 7) {
      await prisma.activity.create({
        data: {
          organizationId: orgId,
          type: 'call',
          subject: `Discovery call with ${l.name}`,
          leadId: lead.id,
          ownerId: l.ownerId,
          isCompleted: true,
          direction: 'outbound',
          createdById: l.ownerId,
          createdAt: daysAgo(l.lastActivityDays),
        },
      });
    }
    await scoreAndSaveLead(lead.id, orgId);
  }

  // Tasks (some overdue, some due soon) for the daily briefing
  await prisma.task.createMany({
    data: [
      { organizationId: orgId, title: 'Send updated proposal to Umbrella Health', dealId: deals[3].id, assignedToId: marcus.id, dueDate: daysAgo(-1), priority: 'high', createdById: marcus.id },
      { organizationId: orgId, title: 'Call Jordan Lee re: Acme negotiation', dealId: deals[0].id, assignedToId: priya.id, dueDate: daysAgo(0), priority: 'urgent', createdById: priya.id },
      { organizationId: orgId, title: 'Prepare QBR deck for Wayne Consulting', dealId: deals[5].id, assignedToId: marcus.id, dueDate: daysAgo(-3), priority: 'medium', createdById: marcus.id },
      { organizationId: orgId, title: 'Qualify Skyler Voss (NexBridge)', assignedToId: priya.id, dueDate: daysAgo(1), priority: 'medium', createdById: priya.id },
    ],
  });

  await detectAnomalies(orgId);

  logger.info('Seed complete.');
  logger.info('Demo login credentials (password: Demo123!):');
  logger.info(`  Admin:   ${admin.email}`);
  logger.info(`  Manager: ${elena.email}`);
  logger.info(`  Rep:     ${priya.email}`);
  logger.info(`  Rep:     ${marcus.email}`);
}
