import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { scoreAndSaveDeal } from '../ai/dealScoring.service';

const app = createApp();

async function signupWithDeal(email: string, orgName: string, dealName: string, value: number, lastActivityDaysAgo: number) {
  const signup = await request(app).post('/api/auth/signup').send({ name: 'Owner', email, password: 'password123', organizationName: orgName });
  const token = signup.body.data.accessToken as string;

  const dealRes = await request(app).post('/api/deals').set('Authorization', `Bearer ${token}`).send({ name: dealName, value });
  const dealId = dealRes.body.data._id as string;

  await prisma.deal.update({ where: { id: dealId }, data: { lastActivityAt: new Date(Date.now() - lastActivityDaysAgo * 86400000) } });
  await scoreAndSaveDeal(dealId, signup.body.data.organization.id);

  return { token, dealId, orgId: signup.body.data.organization.id as string };
}

describe('POST /api/ai/chat', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'which deals are at risk' });
    expect(res.status).toBe(401);
  });

  it('is organization-scoped — org B cannot see org A\'s deals through chat', async () => {
    const a = await signupWithDeal('a@aichattest.example.com', 'AI Chat Test Co A', 'Secret Org A Deal', 99000, 10);
    const b = await signupWithDeal('b@aichattest.example.com', 'AI Chat Test Co B', 'Org B Deal', 5000, 10);

    const chatB = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${b.token}`).send({ message: 'which deals are at risk' });
    expect(chatB.status).toBe(200);

    const atRiskToolResult = chatB.body.data.toolResults.find((t: { name: string }) => t.name === 'getAtRiskDeals');
    expect(atRiskToolResult).toBeDefined();
    const names = (atRiskToolResult.result as { name: string }[]).map((d) => d.name);
    expect(names).not.toContain('Secret Org A Deal');
    expect(names).toContain('Org B Deal');
  });

  it('never returns a numeric score/value that does not trace back to a real DB value (LocalAIProvider)', async () => {
    const { token, dealId, orgId } = await signupWithDeal('trace@aichattest.example.com', 'Trace Test Co', 'Traceable Deal', 42000, 10);

    // Read the real, stored value directly from the DB.
    const realDeal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(realDeal).toBeTruthy();

    const chat = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({ message: 'which deals are at risk' });
    expect(chat.status).toBe(200);

    const atRiskResult = chat.body.data.toolResults.find((t: { name: string }) => t.name === 'getAtRiskDeals');
    const reported = (atRiskResult.result as { name: string; value: number; probability: number }[]).find((d) => d.name === 'Traceable Deal');
    expect(reported).toBeDefined();

    // Every numeric fact returned must exactly equal the real stored/computed value — nothing invented.
    expect(reported!.value).toBe(realDeal!.value);
    expect(reported!.probability).toBe((realDeal!.aiScore as { probability: number }).probability);
    void orgId;
  });

  it('drafting a follow-up for a deal that does not exist explicitly says so instead of fabricating one', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      name: 'Owner',
      email: 'nofab@aichattest.example.com',
      password: 'password123',
      organizationName: 'No Fabrication Co',
    });
    const token = signup.body.data.accessToken as string;

    const chat = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'draft a follow-up for Totally Made Up Company That Does Not Exist' });
    expect(chat.status).toBe(200);
    expect(chat.body.data.message.toLowerCase()).toMatch(/couldn't find|not able to draft|no deal/i);
  });

  it('drafting a follow-up for a real deal uses only that deal\'s real stored name/value', async () => {
    const { token } = await signupWithDeal('draft@aichattest.example.com', 'Draft Test Co', 'Northwind Renewal', 15000, 3);

    const chat = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({ message: 'draft a follow-up for Northwind Renewal' });
    expect(chat.status).toBe(200);
    expect(chat.body.data.message).toContain('Northwind Renewal');
    expect(chat.body.data.message).toContain('$15,000');
  });
});
