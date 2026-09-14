import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

async function setupOrgWithDealAndContact(emailPrefix: string) {
  const signup = await request(app).post('/api/auth/signup').send({
    name: 'Owner',
    email: `${emailPrefix}@contenttest.example.com`,
    password: 'password123',
    organizationName: `${emailPrefix} Co`,
  });
  const token = signup.body.data.accessToken as string;
  const orgId = signup.body.data.organization.id as string;

  const contactRes = await request(app)
    .post('/api/contacts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Jordan Rivera', email: 'jordan@bigcorp.example.com', isDecisionMaker: true });
  const contactId = contactRes.body.data._id as string;

  const dealRes = await request(app)
    .post('/api/deals')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Bigcorp Renewal Deal', value: 27500, primaryContact: contactId });
  const dealId = dealRes.body.data._id as string;

  return { token, orgId, contactId, dealId };
}

describe('Content generation', () => {
  it('generates an email that references the real contact name and deal name — not a placeholder', async () => {
    const { token, dealId } = await setupOrgWithDealAndContact('email');

    const res = await request(app).post('/api/content/email').set('Authorization', `Bearer ${token}`).send({ dealId, purpose: 'follow-up', tone: 'professional' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('email');
    expect(res.body.data.status).toBe('draft');

    const body = res.body.data.content.body as string;
    const subject = res.body.data.content.subject as string;

    expect(body).toContain('Jordan Rivera');
    expect(subject + body).toContain('Bigcorp Renewal Deal');
    expect(body).toContain('$27,500');

    // Never a generic placeholder token.
    expect(body).not.toMatch(/\[Contact Name\]|\[Deal Name\]|\{\{.*\}\}/);
  });

  it('generates a WhatsApp draft referencing the real contact name', async () => {
    const { token, dealId } = await setupOrgWithDealAndContact('whatsapp');
    const res = await request(app).post('/api/content/whatsapp').set('Authorization', `Bearer ${token}`).send({ dealId });
    expect(res.status).toBe(201);
    expect(res.body.data.content.body).toContain('Jordan Rivera');
  });

  it('generates a call script referencing the real deal name in its opening', async () => {
    const { token, dealId } = await setupOrgWithDealAndContact('callscript');
    const res = await request(app).post('/api/content/call-script').set('Authorization', `Bearer ${token}`).send({ dealId });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('call_script');
    expect(res.body.data.content.opening).toContain('Bigcorp Renewal Deal');
    expect(Array.isArray(res.body.data.content.discoveryQuestions)).toBe(true);
  });

  it('generates a proposal section referencing the real deal value', async () => {
    const { token, dealId } = await setupOrgWithDealAndContact('proposal');
    const res = await request(app).post('/api/content/proposal').set('Authorization', `Bearer ${token}`).send({ dealId, section: 'pricing' });
    expect(res.status).toBe(201);
    expect(res.body.data.content.content).toContain('$27,500');
  });

  it('is organization-scoped — org B gets 404 generating content for org A\'s deal', async () => {
    const a = await setupOrgWithDealAndContact('orga');
    const b = await setupOrgWithDealAndContact('orgb');

    const res = await request(app).post('/api/content/email').set('Authorization', `Bearer ${b.token}`).send({ dealId: a.dealId });
    expect(res.status).toBe(404);
  });

  it('404s generating content for a contact that does not belong to the caller\'s org', async () => {
    const a = await setupOrgWithDealAndContact('contacta');
    const b = await setupOrgWithDealAndContact('contactb');

    const res = await request(app).post('/api/content/email').set('Authorization', `Bearer ${b.token}`).send({ contactId: a.contactId });
    expect(res.status).toBe(404);
  });

  it('regenerate creates a NEW draft record and does not mutate the original', async () => {
    const { token, dealId } = await setupOrgWithDealAndContact('regen');

    const first = await request(app).post('/api/content/email').set('Authorization', `Bearer ${token}`).send({ dealId, tone: 'professional' });
    const originalId = first.body.data._id;
    const originalBody = first.body.data.content.body;
    const originalUpdatedAt = first.body.data.updatedAt;

    const regenerated = await request(app).post(`/api/content/${originalId}/regenerate`).set('Authorization', `Bearer ${token}`);
    expect(regenerated.status).toBe(201);
    expect(regenerated.body.data._id).not.toBe(originalId);
    expect(regenerated.body.data.regeneratedFrom).toBe(originalId);

    const originalAfter = await request(app).get(`/api/content/${originalId}`).set('Authorization', `Bearer ${token}`);
    expect(originalAfter.status).toBe(200);
    expect(originalAfter.body.data.content.body).toBe(originalBody);
    expect(originalAfter.body.data.updatedAt).toBe(originalUpdatedAt);
    expect(originalAfter.body.data.status).toBe('draft'); // untouched
  });
});
