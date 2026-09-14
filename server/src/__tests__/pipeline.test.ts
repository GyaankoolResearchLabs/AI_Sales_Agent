import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Pipeline endpoint', () => {
  it('groups deals by the organization\'s actual configured dealStages, not a hardcoded list', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      name: 'Owner',
      email: 'owner@pipelinetest.example.com',
      password: 'password123',
      organizationName: 'Pipeline Test Co',
    });
    const token = signup.body.data.accessToken as string;

    // Replace the org's stages with a custom, non-default set — proves the endpoint
    // isn't reading from a hardcoded stage list baked into the server code.
    const customStages = [
      { key: 'inbound_custom', label: 'Inbound (Custom)', order: 0, probability: 5, isWon: false, isLost: false },
      { key: 'evaluating_custom', label: 'Evaluating (Custom)', order: 1, probability: 50, isWon: false, isLost: false },
      { key: 'closed_won_custom', label: 'Closed Won (Custom)', order: 2, probability: 100, isWon: true, isLost: false },
    ];
    const stagesRes = await request(app)
      .put('/api/organizations/deal-stages')
      .set('Authorization', `Bearer ${token}`)
      .send({ stages: customStages });
    expect(stagesRes.status).toBe(200);

    const dealRes = await request(app)
      .post('/api/deals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Custom stage deal', value: 15000, stageKey: 'evaluating_custom' });
    expect(dealRes.status).toBe(201);

    const pipelineRes = await request(app).get('/api/deals/pipeline').set('Authorization', `Bearer ${token}`);
    expect(pipelineRes.status).toBe(200);

    const stageKeys = pipelineRes.body.data.map((s: { stageKey: string }) => s.stageKey);
    expect(stageKeys).toEqual(['inbound_custom', 'evaluating_custom', 'closed_won_custom']);
    // None of the server's *default* stage keys should appear — proves no hardcoded fallback list leaked in.
    expect(stageKeys).not.toContain('lead');
    expect(stageKeys).not.toContain('proposal');

    const evaluatingStage = pipelineRes.body.data.find((s: { stageKey: string }) => s.stageKey === 'evaluating_custom');
    expect(evaluatingStage.label).toBe('Evaluating (Custom)');
    expect(evaluatingStage.count).toBe(1);
    expect(evaluatingStage.value).toBe(15000);
  });

  it('filters by owner and by value range', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      name: 'Owner2',
      email: 'owner2@pipelinetest.example.com',
      password: 'password123',
      organizationName: 'Pipeline Test Co 2',
    });
    const token = signup.body.data.accessToken as string;

    await request(app).post('/api/deals').set('Authorization', `Bearer ${token}`).send({ name: 'Cheap deal', value: 1000, stageKey: 'lead' });
    await request(app).post('/api/deals').set('Authorization', `Bearer ${token}`).send({ name: 'Expensive deal', value: 100000, stageKey: 'lead' });

    const filtered = await request(app).get('/api/deals/pipeline?minValue=50000').set('Authorization', `Bearer ${token}`);
    expect(filtered.status).toBe(200);
    const leadStage = filtered.body.data.find((s: { stageKey: string }) => s.stageKey === 'lead');
    expect(leadStage.count).toBe(1);
    expect(leadStage.deals[0].name).toBe('Expensive deal');
  });
});
