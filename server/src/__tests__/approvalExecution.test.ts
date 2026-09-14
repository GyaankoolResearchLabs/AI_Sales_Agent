import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import * as executionProviders from '../integrations/executionProviders';

const app = createApp();

async function setup(emailPrefix: string) {
  const signup = await request(app).post('/api/auth/signup').send({
    name: 'Owner',
    email: `${emailPrefix}@approvalexec.example.com`,
    password: 'password123',
    organizationName: `${emailPrefix} Exec Co`,
  });
  const token = signup.body.data.accessToken as string;
  const orgId = signup.body.data.organization.id as string;

  const contactRes = await request(app)
    .post('/api/contacts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Dana Real', email: 'dana.real@bigcorp.example.com', isDecisionMaker: true });
  const contactId = contactRes.body.data._id as string;

  const dealRes = await request(app)
    .post('/api/deals')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Execution Test Deal', value: 33000, primaryContact: contactId });
  const dealId = dealRes.body.data._id as string;

  return { token, orgId, contactId, dealId };
}

describe('Provider selection', () => {
  it('uses DevelopmentEmailProvider when no SMTP env vars are set (this environment\'s real state)', () => {
    // Not testing SmtpProvider here — SMTP_HOST is genuinely unset in this environment
    // (confirmed earlier: no .env file exists on disk), so only the dev path is exercised.
    expect(process.env.SMTP_HOST).toBeFalsy();
    const provider = executionProviders.resolveEmailExecutionProvider();
    expect(provider.name).toBe('development');
    expect(provider.environment).toBe('development');
  });

  it('uses DevelopmentWhatsAppProvider when no WhatsApp env vars are set', () => {
    expect(process.env.WHATSAPP_ACCESS_TOKEN).toBeFalsy();
    const provider = executionProviders.resolveWhatsAppExecutionProvider();
    expect(provider.name).toBe('development');
    expect(provider.environment).toBe('development');
  });
});

describe('Approval send-execution — real DevEmailProvider path', () => {
  it('approving an email-category approval creates a real Email record with the exact ContentDraft content', async () => {
    const { token, dealId } = await setup('devsend');

    const draftRes = await request(app).post('/api/content/email').set('Authorization', `Bearer ${token}`).send({ dealId, purpose: 'follow-up' });
    const contentDraftId = draftRes.body.data._id as string;
    const draftSubject = draftRes.body.data.content.subject as string;
    const draftBody = draftRes.body.data.content.body as string;

    const approvalRes = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, contentDraftId, title: 'Send follow-up', reason: 'test', permissionCategory: 'emailSending', confidence: 60 });
    const approvalId = approvalRes.body.data._id as string;

    const approveRes = await request(app).post(`/api/approvals/${approvalId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.sendResult.attempted).toBe(true);
    expect(approveRes.body.sendResult.success).toBe(true);
    expect(approveRes.body.sendResult.provider).toBe('development');
    expect(approveRes.body.sendResult.environment).toBe('development');

    // Verify against the real DB — not just the response body.
    const emailDoc = await prisma.email.findFirst({ where: { dealId } });
    expect(emailDoc).toBeTruthy();
    expect(emailDoc!.to).toBe('dana.real@bigcorp.example.com');
    expect(emailDoc!.subject).toBe(draftSubject);
    expect(emailDoc!.body).toBe(draftBody);
    expect(emailDoc!.status).toBe('sent');
    expect(emailDoc!.provider).toBe('development');

    const draftAfter = await prisma.contentDraft.findUnique({ where: { id: contentDraftId } });
    expect(draftAfter!.status).toBe('sent');

    const auditEntry = await prisma.auditLog.findFirst({ where: { action: 'approval.executed', entityId: approvalId } });
    expect(auditEntry).toBeTruthy();
  });

  it('a missing contact email leaves the ContentDraft "approved" (not "sent") and logs the failure', async () => {
    const { token, dealId } = await setup('nocontact');

    const contactRes = await request(app).post('/api/contacts').set('Authorization', `Bearer ${token}`).send({ name: 'No Email Guy' });
    const noEmailContactId = contactRes.body.data._id;
    await request(app).patch(`/api/deals/${dealId}`).set('Authorization', `Bearer ${token}`).send({ primaryContact: noEmailContactId });

    const draftRes = await request(app).post('/api/content/email').set('Authorization', `Bearer ${token}`).send({ dealId, contactId: noEmailContactId });
    const contentDraftId = draftRes.body.data._id;

    const approvalRes = await request(app)
      .post('/api/approvals')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, contentDraftId, title: 'Send follow-up', reason: 'test', permissionCategory: 'emailSending', confidence: 60 });
    const approvalId = approvalRes.body.data._id;

    const approveRes = await request(app).post(`/api/approvals/${approvalId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.sendResult.attempted).toBe(true);
    expect(approveRes.body.sendResult.success).toBe(false);
    expect(approveRes.body.sendResult.error).toMatch(/no contact email/i);

    const draftAfter = await prisma.contentDraft.findUnique({ where: { id: contentDraftId } });
    expect(draftAfter!.status).toBe('approved'); // not "sent"

    const failureLog = await prisma.auditLog.findFirst({ where: { action: 'approval.execution_failed', entityId: approvalId } });
    expect(failureLog).toBeTruthy();
    expect((failureLog!.metadata as { error?: string })?.error).toMatch(/no contact email/i);

    // The approval decision itself still succeeded — only delivery failed.
    const approvalAfter = await prisma.approval.findUnique({ where: { id: approvalId } });
    expect(approvalAfter!.status).toBe('approved');
  });

  it('a throwing provider is caught gracefully — reported as a failure, not a crashed request', async () => {
    const spy = jest.spyOn(executionProviders, 'resolveEmailExecutionProvider').mockImplementation(() => {
      throw new Error('Simulated provider construction failure');
    });

    try {
      const { token, dealId } = await setup('throwingprovider');

      const draftRes = await request(app).post('/api/content/email').set('Authorization', `Bearer ${token}`).send({ dealId });
      const contentDraftId = draftRes.body.data._id;

      const approvalRes = await request(app)
        .post('/api/approvals')
        .set('Authorization', `Bearer ${token}`)
        .send({ dealId, contentDraftId, title: 'Send follow-up', reason: 'test', permissionCategory: 'emailSending', confidence: 60 });
      const approvalId = approvalRes.body.data._id;

      const approveRes = await request(app).post(`/api/approvals/${approvalId}/approve`).set('Authorization', `Bearer ${token}`);
      expect(approveRes.status).toBe(200); // the approve decision itself does not crash
      expect(approveRes.body.sendResult.success).toBe(false);
      expect(approveRes.body.sendResult.error).toMatch(/simulated provider construction failure/i);

      const draftAfter = await prisma.contentDraft.findUnique({ where: { id: contentDraftId } });
      expect(draftAfter!.status).toBe('approved');
    } finally {
      spy.mockRestore();
    }
  });
});
