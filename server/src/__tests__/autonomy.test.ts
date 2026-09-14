import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/prisma';

const app = createApp();

async function signupAndCreateDeal() {
  const signup = await request(app).post('/api/auth/signup').send({
    name: 'Owner',
    email: 'owner@autonomytest.example.com',
    password: 'password123',
    organizationName: 'Autonomy Test Co',
  });
  const token = signup.body.data.accessToken as string;
  const orgId = signup.body.data.organization.id as string;

  const dealRes = await request(app).post('/api/deals').set('Authorization', `Bearer ${token}`).send({ name: 'Gated deal', value: 1000 });
  return { token, orgId, dealId: dealRes.body.data._id as string };
}

describe('Autonomy permission gates', () => {
  it('blocks execution of an approval-required action until it is approved', async () => {
    const { token, dealId } = await signupAndCreateDeal();

    const quick = await request(app)
      .post('/api/recommendations/quick')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, channel: 'email', title: 'Send follow-up', reason: 'test', body: 'Hello' });
    expect(quick.body.data.permissionRequirement).toBe('approval_required');
    const recId = quick.body.data._id;

    const executeBeforeApproval = await request(app).post(`/api/recommendations/${recId}/execute`).set('Authorization', `Bearer ${token}`);
    expect(executeBeforeApproval.status).toBe(403);

    const approve = await request(app).post(`/api/recommendations/${recId}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approve.status).toBe(200);

    const executeAfterApproval = await request(app).post(`/api/recommendations/${recId}/execute`).set('Authorization', `Bearer ${token}`);
    expect(executeAfterApproval.status).toBe(200);
  });

  it('allows immediate execution when the permission is set to "allowed"', async () => {
    const { token, orgId, dealId } = await signupAndCreateDeal();

    await prisma.autonomySettings.update({ where: { organizationId: orgId }, data: { emailSending: 'allowed' } });

    const quick = await request(app)
      .post('/api/recommendations/quick')
      .set('Authorization', `Bearer ${token}`)
      .send({ dealId, channel: 'email', title: 'Send follow-up', reason: 'test', body: 'Hello' });
    expect(quick.body.data.permissionRequirement).toBe('allowed');

    const execute = await request(app).post(`/api/recommendations/${quick.body.data._id}/execute`).set('Authorization', `Bearer ${token}`);
    expect(execute.status).toBe(200);
  });
});
