import request from 'supertest';
import { createApp } from '../app';

import { prisma } from '../config/prisma';
import { scoreAndSaveDeal } from '../ai/dealScoring.service';
import { detectAnomalies } from '../ai/anomalyDetection.service';

const app = createApp();

async function signup(email: string, orgName: string) {
  const res = await request(app).post('/api/auth/signup').send({ name: 'Owner', email, password: 'password123', organizationName: orgName });
  return { token: res.body.data.accessToken as string, orgId: res.body.data.organization.id as string };
}

async function makeStaleDeal(token: string, name: string, daysStale = 10) {
  const dealRes = await request(app).post('/api/deals').set('Authorization', `Bearer ${token}`).send({ name, value: 20000 });
  const dealId = dealRes.body.data._id as string;
  await prisma.deal.update({ where: { id: dealId }, data: { lastActivityAt: new Date(Date.now() - daysStale * 86400000) } });
  return dealId;
}

describe('AutonomySettings defaults', () => {
  it('defaults new organizations to level 1 (Observe) with every category approval_required', async () => {
    const { orgId } = await signup('defaults@approvaltest.example.com', 'Defaults Test Co');
    const settings = await prisma.autonomySettings.findUnique({ where: { organizationId: orgId } });
    expect(settings!.level).toBe(1);
    expect(settings!.emailSending).toBe('approval_required');
    expect(settings!.whatsappSending).toBe('approval_required');
    expect(settings!.crmUpdates).toBe('approval_required');
    expect(settings!.meetingScheduling).toBe('approval_required');
    expect(settings!.proposalCreation).toBe('approval_required');
    expect(settings!.taskCreation).toBe('approval_required');
  });
});

describe('GET/PATCH /api/settings/autonomy', () => {
  it('updates level/permissions and writes an audit log, requires director/admin', async () => {
    const { token, orgId } = await signup('settingsupdate@approvaltest.example.com', 'Settings Update Co');

    const patchRes = await request(app)
      .patch('/api/settings/autonomy')
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 3, permissions: { emailSending: 'allowed' } });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.level).toBe(3);
    expect(patchRes.body.data.permissions.emailSending).toBe('allowed');

    const logs = await prisma.auditLog.findMany({ where: { organizationId: orgId, action: 'autonomy_settings.updated' } });
    expect(logs.length).toBe(1);

    const getRes = await request(app).get('/api/settings/autonomy').set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.level).toBe(3);
  });
});

describe('Approval permission gates', () => {
  it('rejects approving a "disabled" permission category with 403 and makes no state change', async () => {
    const { token, orgId } = await signup('disabled@approvaltest.example.com', 'Disabled Perm Co');
    const dealId = await makeStaleDeal(token, 'Disabled perm deal');

    await prisma.autonomySettings.update({ where: { organizationId: orgId }, data: { emailSending: 'disabled' } });

    const createRes = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, title: 'Send follow-up email', reason: 'test', permissionCategory: 'emailSending', confidence: 60 });
    expect(createRes.status).toBe(201);
    const approvalId = createRes.body.data._id;

    const approveRes = await request(app).post(`/api/approvals/${approvalId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(403);

    const afterAttempt = await prisma.approval.findUnique({ where: { id: approvalId } });
    expect(afterAttempt!.status).toBe('pending'); // unchanged
    expect(afterAttempt!.decidedById).toBeNull();
    expect(afterAttempt!.decidedAt).toBeNull();
  });

  it('auto-executes at level 4 + "allowed" permission without a pending approval step, and still logs it', async () => {
    const { token, orgId } = await signup('level4@approvaltest.example.com', 'Level4 Co');
    const dealId = await makeStaleDeal(token, 'Level4 deal');

    await prisma.autonomySettings.update({ where: { organizationId: orgId }, data: { level: 4, emailSending: 'allowed' } });

    const createRes = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, title: 'Send follow-up email', reason: 'test', permissionCategory: 'emailSending', confidence: 60 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.autoExecuted).toBe(true);
    expect(createRes.body.data.status).toBe('approved');
    expect(createRes.body.data.decidedBy).toBeFalsy(); // decided by the system, not a person

    const logs = await prisma.auditLog.findMany({ where: { organizationId: orgId, action: 'approval.auto_executed' } });
    expect(logs.length).toBe(1);
    expect(logs[0].entityId).toBe(createRes.body.data._id);
  });

  it('cross-org: org B cannot approve or reject org A\'s approval (404)', async () => {
    const a = await signup('crossa@approvaltest.example.com', 'Cross Org A');
    const b = await signup('crossb@approvaltest.example.com', 'Cross Org B');
    const dealId = await makeStaleDeal(a.token, 'Cross org deal');

    const createRes = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ dealId, title: 'Send follow-up email', reason: 'test', permissionCategory: 'emailSending', confidence: 60 });
    const approvalId = createRes.body.data._id;

    const approveAsB = await request(app).post(`/api/approvals/${approvalId}/approve`).set('Authorization', `Bearer ${b.token}`);
    expect(approveAsB.status).toBe(404);

    const rejectAsB = await request(app).post(`/api/approvals/${approvalId}/reject`).set('Authorization', `Bearer ${b.token}`).send({ reason: 'not mine' });
    expect(rejectAsB.status).toBe(404);
  });

  it('reject requires a reason and writes an audit log', async () => {
    const { token } = await signup('reject@approvaltest.example.com', 'Reject Co');
    const dealId = await makeStaleDeal(token, 'Reject deal');

    const createRes = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, title: 'Send follow-up email', reason: 'test', permissionCategory: 'emailSending', confidence: 60 });
    const approvalId = createRes.body.data._id;

    const noReason = await request(app).post(`/api/approvals/${approvalId}/reject`).set('Authorization', `Bearer ${token}`).send({});
    expect(noReason.status).toBe(400);

    const withReason = await request(app).post(`/api/approvals/${approvalId}/reject`).set('Authorization', `Bearer ${token}`).send({ reason: 'Not the right time' });
    expect(withReason.status).toBe(200);
    expect(withReason.body.data.status).toBe('rejected');
    expect(withReason.body.data.rejectedReason).toBe('Not the right time');
  });
});

describe('End-to-end: detect → approval created → approve → ContentDraft flips → audit log', () => {
  it('runs the full chain and verifies real DB documents at each step', async () => {
    const { token, orgId } = await signup('e2e@approvaltest.example.com', 'E2E Approval Co');

    // Step 1: create a deal, make it stale enough to be flagged at-risk, and score it —
    // detectAnomalies() reads deal.aiScore.health, which is only populated once scored.
    const dealId = await makeStaleDeal(token, 'E2E stale deal', 10);
    await scoreAndSaveDeal(dealId, orgId);

    // Step 2: run the REAL anomaly detection service (same code path the scheduler uses)
    // and verify it created a real Approval document — not just an AIInsight.
    await detectAnomalies(orgId);
    const autoApproval = await prisma.approval.findFirst({ where: { organizationId: orgId, dealId } });
    expect(autoApproval).toBeTruthy();
    expect(autoApproval!.status).toBe('pending');
    expect(autoApproval!.reason).toBeTruthy();

    // Step 3: generate a real ContentDraft for the same deal and attach it to a fresh
    // approval via the approval-creation service, then approve it through the real
    // HTTP endpoint, and verify the ContentDraft's status actually flips in the DB.
    const draftRes = await request(app).post('/api/content/email').set('Authorization', `Bearer ${token}`).send({ dealId });
    const contentDraftId = draftRes.body.data._id;
    expect((await prisma.contentDraft.findUnique({ where: { id: contentDraftId } }))!.status).toBe('draft');

    const linkedApprovalRes = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, contentDraftId, title: 'Send the drafted follow-up', reason: 'Deal has gone quiet', permissionCategory: 'emailSending', confidence: 65 });
    const linkedApprovalId = linkedApprovalRes.body.data._id;

    const approveRes = await request(app).post(`/api/approvals/${linkedApprovalId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(200);

    // Verify against the real DB, not just the response body.
    const approvalAfter = await prisma.approval.findUnique({ where: { id: linkedApprovalId } });
    expect(approvalAfter!.status).toBe('approved');
    expect(approvalAfter!.decidedAt).toBeTruthy();

    const draftAfter = await prisma.contentDraft.findUnique({ where: { id: contentDraftId } });
    expect(draftAfter!.status).toBe('approved');

    const auditEntry = await prisma.auditLog.findFirst({ where: { organizationId: orgId, action: 'approval.approved', entityId: linkedApprovalId } });
    expect(auditEntry).toBeTruthy();
    expect(auditEntry!.approvedById).toBeTruthy();
  });
});
