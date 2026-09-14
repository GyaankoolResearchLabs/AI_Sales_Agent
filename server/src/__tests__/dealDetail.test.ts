import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Deal detail endpoint', () => {
  it('404s for a deal belonging to a different organization', async () => {
    const signupA = await request(app).post('/api/auth/signup').send({
      name: 'Owner A',
      email: 'ownera@dealdetailtest.example.com',
      password: 'password123',
      organizationName: 'Detail Test Co A',
    });
    const tokenA = signupA.body.data.accessToken as string;

    const signupB = await request(app).post('/api/auth/signup').send({
      name: 'Owner B',
      email: 'ownerb@dealdetailtest.example.com',
      password: 'password123',
      organizationName: 'Detail Test Co B',
    });
    const tokenB = signupB.body.data.accessToken as string;

    const dealRes = await request(app).post('/api/deals').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Org A deal', value: 5000 });
    const dealId = dealRes.body.data._id;

    const crossOrgFetch = await request(app).get(`/api/deals/${dealId}/detail`).set('Authorization', `Bearer ${tokenB}`);
    expect(crossOrgFetch.status).toBe(404);

    const ownFetch = await request(app).get(`/api/deals/${dealId}/detail`).set('Authorization', `Bearer ${tokenA}`);
    expect(ownFetch.status).toBe(200);
    expect(ownFetch.body.data.deal.name).toBe('Org A deal');
    expect(ownFetch.body.data).toHaveProperty('activities');
    expect(ownFetch.body.data).toHaveProperty('conversations');
    expect(ownFetch.body.data).toHaveProperty('tasks');
    expect(ownFetch.body.data).toHaveProperty('contacts');
  });

  it('returns the close-probability score with its per-factor breakdown', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      name: 'Owner',
      email: 'owner@dealscorebreakdown.example.com',
      password: 'password123',
      organizationName: 'Score Breakdown Co',
    });
    const token = signup.body.data.accessToken as string;

    const dealRes = await request(app).post('/api/deals').set('Authorization', `Bearer ${token}`).send({ name: 'Scored deal', value: 8000 });
    const dealId = dealRes.body.data._id;

    const detail = await request(app).get(`/api/deals/${dealId}/detail`).set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    const aiScore = detail.body.data.deal.aiScore;
    expect(aiScore).toBeDefined();
    expect(typeof aiScore.probability).toBe('number');
    expect(Array.isArray(aiScore.factors)).toBe(true);
    expect(aiScore.factors.length).toBe(5);
    const totalWeight = aiScore.factors.reduce((sum: number, f: { weight: number }) => sum + f.weight, 0);
    expect(totalWeight).toBe(100);
  });
});
