import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Authentication', () => {
  const signupPayload = {
    name: 'Test Rep',
    email: 'rep@testco.example.com',
    password: 'password123',
    organizationName: 'Test Co',
  };

  it('signs up a new user and organization', async () => {
    const res = await request(app).post('/api/auth/signup').send(signupPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(signupPayload.email);
    expect(res.body.data.organization.name).toBe('Test Co');
  });

  it('rejects duplicate signup emails', async () => {
    await request(app).post('/api/auth/signup').send(signupPayload);
    const res = await request(app).post('/api/auth/signup').send(signupPayload);
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await request(app).post('/api/auth/signup').send(signupPayload);

    const good = await request(app).post('/api/auth/login').send({ email: signupPayload.email, password: signupPayload.password });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email: signupPayload.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('rejects protected routes without a token, and accepts with one', async () => {
    const signup = await request(app).post('/api/auth/signup').send(signupPayload);
    const token = signup.body.data.accessToken;

    const noAuth = await request(app).get('/api/leads');
    expect(noAuth.status).toBe(401);

    const withAuth = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(withAuth.status).toBe(200);
    expect(withAuth.body.success).toBe(true);
  });
});
