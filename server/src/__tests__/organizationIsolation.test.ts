import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

async function signup(email: string, orgName: string) {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'User',
    email,
    password: 'password123',
    organizationName: orgName,
  });
  return res.body.data.accessToken as string;
}

describe('Multi-tenant organization isolation', () => {
  it('never lets one organization see another organization\'s leads', async () => {
    const tokenA = await signup('a@companya.example.com', 'Company A');
    const tokenB = await signup('b@companyb.example.com', 'Company B');

    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Secret Lead A' });
    expect(createRes.status).toBe(201);
    const leadId = createRes.body.data._id;

    // Org B's list must not contain org A's lead
    const listB = await request(app).get('/api/leads').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(listB.body.data.find((l: { _id: string }) => l._id === leadId)).toBeUndefined();

    // Org B fetching org A's lead directly must 404, not leak data
    const getB = await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(getB.status).toBe(404);

    // Org A can see its own lead
    const getA = await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(getA.status).toBe(200);
    expect(getA.body.data.name).toBe('Secret Lead A');
  });
});
