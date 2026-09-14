/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
async function asJson(res: Response): Promise<any> {
  return res.json();
}

async function run() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'smoke-refresh-secret';

  const { disconnectPrisma } = await import('../config/prisma');
  const { runSeed } = await import('../seed/seedLogic');
  await runSeed();

  const { createApp } = await import('../app');
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  console.log(`SMOKE_SERVER_PORT=${port}`);

  const base = `http://localhost:${port}/api`;

  const health = await asJson(await fetch(`${base}/health`));
  console.log('health:', JSON.stringify(health));

  const login = await asJson(
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@northwind.demo', password: 'Demo123!' }),
    })
  );
  console.log('login success:', login.success, 'user:', login.data?.user?.name);

  const token = login.data.accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  const briefing = await asJson(await fetch(`${base}/dashboard/briefing`, { headers: auth }));
  console.log('briefing hotLeads:', briefing.data?.hotLeads?.length, 'atRiskDeals:', briefing.data?.atRiskDeals?.length);

  const deals = await asJson(await fetch(`${base}/deals`, { headers: auth }));
  console.log('deals count:', deals.data?.length, 'first deal aiScore:', JSON.stringify(deals.data?.[0]?.aiScore?.probability));

  const chat = await asJson(
    await fetch(`${base}/ai/chat`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'which deals are at risk?' }),
    })
  );
  console.log('chat response:', JSON.stringify(chat.data?.message), 'toolResults:', chat.data?.toolResults?.map((t: any) => t.name));

  const forecast = await asJson(await fetch(`${base}/forecast`, { headers: auth }));
  console.log('forecast:', JSON.stringify(forecast.data?.pipelineValue), JSON.stringify(forecast.data?.weightedPipeline));

  const managerLogin = await asJson(
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'elena@northwind.demo', password: 'Demo123!' }),
    })
  );
  const managerAuth = { Authorization: `Bearer ${managerLogin.data.accessToken}` };
  const managerDash = await asJson(await fetch(`${base}/dashboard/manager`, { headers: managerAuth }));
  console.log('manager dashboard winRate:', managerDash.data?.winRate, 'byRep count:', managerDash.data?.byRep?.length);

  const insights = await asJson(await fetch(`${base}/insights`, { headers: auth }));
  console.log('insights count:', insights.data?.length, 'types:', insights.data?.map((i: any) => i.type));

  server.close();
  await disconnectPrisma();
  console.log('SMOKE TEST PASSED');
}

run().catch((err) => {
  console.error('SMOKE TEST FAILED', err);
  process.exit(1);
});
