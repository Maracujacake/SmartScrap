import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/database.js';

let db, app, server, url, cookie;

async function request(path, options = {}) {
  const response = await fetch(`${url}/api${path}`, options);
  return { status: response.status, headers: response.headers, data: await response.json() };
}

before(async () => {
  db = createDatabase(':memory:');
  app = createApp(db, { email: { env: {}, autoStart: false } });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ana@horizonte.com.br', password: 'Demo@123' }),
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  app.locals.email.close();
  app.locals.visualAnalysis.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test('saúde é pública, cabeçalhos são preservados e recursos desconhecidos exigem sessão', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.data, { status: 'ok' });
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('referrer-policy'), 'same-origin');
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/unknown')).status, 401);
  const missing = await request('/unknown', { headers: { cookie } });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.data, { error: 'Recurso não encontrado.' });
});

test('origem, JSON inválido e limite de corpo são verificados antes da autenticação', async () => {
  const crossSite = await request('/lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'cross-site' },
    body: '{',
  });
  assert.equal(crossSite.status, 403);
  assert.deepEqual(crossSite.data, { error: 'Origem não permitida.' });

  const malformed = await request('/lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.data, { error: 'JSON inválido.' });

  const array = await request('/lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '[]',
  });
  assert.equal(array.status, 400);
  assert.deepEqual(array.data, { error: 'Envie um objeto JSON válido.' });

  const oversized = await request('/lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'x'.repeat(33 * 1024) }),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.data, { error: 'Os dados enviados excedem o limite permitido.' });
});

test('dashboard mantém períodos, totais e os dados da organização após separar as rotas', async () => {
  for (const days of [7, 30, 90, 365, 'invalid']) {
    const response = await request(`/dashboard?days=${days}`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.data.days, days === 'invalid' ? 30 : days);
    const { stats, previous, composition, chart, lots, pickups } = response.data;
    for (const value of Object.values(stats)) assert.ok(Number.isFinite(value));
    assert.deepEqual(Object.keys(previous).sort(), ['bought', 'sold', 'value']);
    assert.equal(chart.length, 8);
    assert.ok(
      Math.abs(composition.reduce((sum, item) => sum + item.weight, 0) - stats.sold) < 1e-9,
    );
    assert.ok(lots.length <= 5);
    assert.ok(lots.every((lot) => lot.organization_id === 1 && lot.status !== 'sold'));
    assert.ok(pickups.length <= 3);
    assert.ok(
      pickups.every(
        (pickup) =>
          (pickup.seller_id === 1 || pickup.buyer_id === 1) && pickup.status !== 'delivered',
      ),
    );
  }
});
