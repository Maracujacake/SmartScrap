import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';

let db, app, server, url;
const clients = {};
async function request(path, { client, method = 'GET', body } = {}) {
  const response = await fetch(`${url}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(clients[client] ? { cookie: clients[client] } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (client && response.headers.get('set-cookie'))
    clients[client] = response.headers.get('set-cookie').split(';')[0];
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function login(client, email) {
  const response = await request('/auth/login', {
    client,
    method: 'POST',
    body: { email, password: 'Demo@123' },
  });
  assert.equal(response.status, 200);
  return response.data.user;
}
before(async () => {
  db = createDatabase(':memory:');
  app = createApp(db, { email: { env: {}, autoStart: false } });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  app.locals.email.close();
  app.locals.visualAnalysis.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test('autenticação exige uma sessão e não expõe senhas', async () => {
  assert.equal((await request('/dashboard')).status, 401);
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: 'ana@horizonte.com.br', password: 'errada' },
      })
    ).status,
    401,
  );
  const user = await login('seller', 'ana@horizonte.com.br');
  assert.equal(user.organization_name, 'Metalúrgica Horizonte');
  assert.equal(user.password_hash, undefined);
  await login('buyer', 'lucas@ecometal.com.br');
  await login('other', 'marina@alumitech.com.br');
});

test('cadastro diferencia ONG e permite ingresso por convite sem expor códigos no diretório', async () => {
  const joined = await request('/auth/register', {
    client: 'colleague',
    method: 'POST',
    body: {
      name: 'Colega Teste',
      email: 'colega@example.test',
      password: 'Teste@123',
      inviteCode: 'HORIZONTE-DEMO',
    },
  });
  assert.equal(joined.status, 201);
  assert.equal(joined.data.user.organization_id, 1);
  const invalid = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Teste',
      email: 'invalido@example.test',
      password: 'Teste@123',
      inviteCode: 'NAO-EXISTE',
    },
  });
  assert.equal(invalid.status, 400);
  const ngo = await request('/auth/register', {
    client: 'ngo',
    method: 'POST',
    body: {
      name: 'Pessoa ONG',
      email: 'ong@example.test',
      password: 'Teste@123',
      organizationName: 'ONG Teste',
      organizationType: 'ngo',
      city: 'Santos',
      state: 'SP',
    },
  });
  assert.equal(ngo.status, 201);
  assert.equal(ngo.data.user.organization_type, 'ngo');
  const directory = await request('/organizations', { client: 'seller' });
  assert.equal(directory.status, 200);
  assert.ok(directory.data.organizations.every((org) => !('invite_code' in org)));
  assert.ok(!directory.data.organizations.some((org) => org.name === 'ONG Teste'));
});

let lotId, acceptedId, competingId, pickupId;
test('publicação valida dados e compartilha lotes e dashboard entre usuários da mesma organização', async () => {
  const body = {
    title: 'Lote para teste de negociação',
    material: 'Cobre',
    weight: 2,
    price: 30,
    description: 'Cobre selecionado e separado para testar o ciclo completo.',
  };
  assert.equal(
    (await request('/lots', { client: 'seller', method: 'POST', body: { ...body, weight: -1 } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/lots', {
        client: 'seller',
        method: 'POST',
        body: { ...body, material: 'Inválido' },
      })
    ).status,
    400,
  );
  const created = await request('/lots', { client: 'seller', method: 'POST', body });
  assert.equal(created.status, 201);
  assert.equal(created.data.lot.quality, '');
  lotId = created.data.lot.id;
  const shared = await request('/lots?scope=mine', { client: 'colleague' });
  assert.ok(shared.data.lots.some((l) => l.id === lotId));
  const [first, second] = await Promise.all([
    request('/dashboard', { client: 'seller' }),
    request('/dashboard', { client: 'colleague' }),
  ]);
  assert.deepEqual(first.data.stats, second.data.stats);
  const other = await request('/lots?scope=mine', { client: 'buyer' });
  assert.ok(!other.data.lots.some((l) => l.id === lotId));
});

test('filtros por organização e metal funcionam, e ninguém pode propor compra do próprio lote', async () => {
  const filtered = await request('/lots?company=1&material=Cobre', { client: 'buyer' });
  assert.ok(filtered.data.lots.length > 0);
  assert.ok(filtered.data.lots.every((l) => l.organization_id === 1 && l.material === 'Cobre'));
  assert.equal(
    (
      await request(`/lots/${lotId}/proposals`, {
        client: 'colleague',
        method: 'POST',
        body: { price: 29 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/lots/${lotId}/proposals`, {
        client: 'buyer',
        method: 'POST',
        body: { price: 29, message: 'Retiramos o lote completo.' },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request(`/lots/${lotId}/proposals`, {
        client: 'buyer',
        method: 'POST',
        body: { price: 29 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/lots/${lotId}/proposals`, {
        client: 'other',
        method: 'POST',
        body: { price: 28 },
      })
    ).status,
    201,
  );
  const detail = await request(`/lots/${lotId}`, { client: 'seller' });
  assert.equal(detail.data.proposals.length, 2);
  acceptedId = detail.data.proposals.find((p) => p.organization_id === 2).id;
  competingId = detail.data.proposals.find((p) => p.organization_id === 3).id;
  const buyerDetail = await request(`/lots/${lotId}`, { client: 'buyer' });
  assert.equal(buyerDetail.data.proposals.length, 1);
  assert.equal(buyerDetail.data.proposals[0].organization_id, 2);
});

test('aceite é exclusivo do vendedor, encerra concorrentes e cria uma única coleta', async () => {
  assert.equal(
    (
      await request(`/proposals/${acceptedId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { status: 'accepted' },
      })
    ).status,
    403,
  );
  const before = (await request('/dashboard', { client: 'seller' })).data.stats;
  const concurrent = await Promise.all(
    ['colleague', 'seller'].map((client) =>
      request(`/proposals/${acceptedId}`, {
        client,
        method: 'PATCH',
        body: { status: 'accepted' },
      }),
    ),
  );
  assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
  assert.equal(
    (
      await request(`/proposals/${acceptedId}`, {
        client: 'seller',
        method: 'PATCH',
        body: { status: 'accepted' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/proposals/${competingId}`, {
        client: 'seller',
        method: 'PATCH',
        body: { status: 'accepted' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/lots/${lotId}/proposals`, {
        client: 'other',
        method: 'POST',
        body: { price: 31 },
      })
    ).status,
    409,
  );
  const detail = await request(`/lots/${lotId}`, { client: 'seller' });
  assert.equal(detail.data.lot.status, 'sold');
  assert.equal(detail.data.proposals.find((p) => p.id === competingId).status, 'rejected');
  const pickups = (await request('/pickups', { client: 'buyer' })).data.pickups.filter(
    (p) => p.lot_id === lotId,
  );
  assert.equal(pickups.length, 1);
  assert.equal(pickups[0].total_cents, 5800000);
  assert.equal(pickups[0].status, 'awaiting');
  pickupId = pickups[0].id;
  const after = (await request('/dashboard', { client: 'seller' })).data.stats;
  assert.equal(after.sold, before.sold + 2);
  assert.equal(after.value, before.value + 58000);
  assert.equal(after.active, before.active - 1);
  const notes = await request('/notifications', { client: 'buyer' });
  assert.ok(
    notes.data.notifications.some(
      (n) => n.lot_id === lotId && n.title === 'Sua proposta foi aceita',
    ),
  );
});

test('coleta exige empresa associada, permite ambas as partes escolherem a logística e preserva etapas', async () => {
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'other',
        method: 'PATCH',
        body: { transportKind: 'seller' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { status: 'delivered' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { status: 'scheduled', scheduledDate: date, carrier: 'Texto livre não basta' },
      })
    ).status,
    400,
  );
  const companies = (await request('/transport-companies', { client: 'buyer' })).data.companies;
  const example = companies.find((company) => company.name === 'Exemplo Transporters LTDA');
  assert.ok(example);
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { transportKind: 'external', transportCompanyId: 999999 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { transportKind: 'invalid' },
      })
    ).status,
    400,
  );
  for (const [client, transportKind] of [
    ['buyer', 'seller'],
    ['seller', 'buyer'],
  ]) {
    assert.equal(
      (await request(`/pickups/${pickupId}`, { client, method: 'PATCH', body: { transportKind } }))
        .status,
      200,
    );
    const current = (await request('/pickups', { client })).data.pickups.find(
      (p) => p.id === pickupId,
    );
    assert.equal(current.status, 'awaiting');
    assert.equal(current.transport_kind, transportKind);
    assert.equal(current.transport_company_id, null);
    assert.equal(
      current.carrier,
      transportKind === 'seller' ? 'Metalúrgica Horizonte' : 'EcoMetal Reciclagem',
    );
  }
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { transportKind: 'external', transportCompanyId: example.id },
      })
    ).status,
    200,
  );
  const freightBody = { transportCompanyId: example.id, distanceKm: 100, freightPayer: 'buyer' };
  const quotation = await request(`/pickups/${pickupId}/freight-quote`, {
    client: 'buyer',
    method: 'POST',
    body: freightBody,
  });
  assert.equal(quotation.status, 200);
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { ...freightBody, confirmFreight: true, quoteToken: quotation.data.quote.quoteToken },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { status: 'scheduled', scheduledDate: '2026-02-31' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { status: 'scheduled', scheduledDate: date },
      })
    ).status,
    200,
  );
  const scheduled = (await request('/pickups', { client: 'seller' })).data.pickups.find(
    (p) => p.id === pickupId,
  );
  assert.equal(scheduled.carrier, example.name);
  assert.equal(scheduled.transport_company_id, example.id);
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'seller',
        method: 'PATCH',
        body: { transportKind: 'buyer' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'seller',
        method: 'PATCH',
        body: { status: 'transit' },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { transportKind: 'seller' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/pickups/${pickupId}`, {
        client: 'buyer',
        method: 'PATCH',
        body: { status: 'delivered' },
      })
    ).status,
    200,
  );
  const pickup = (await request('/pickups', { client: 'seller' })).data.pickups.find(
    (p) => p.id === pickupId,
  );
  assert.equal(pickup.status, 'delivered');
  assert.equal(pickup.carrier, 'EcoMetal Reciclagem');
  assert.ok(pickup.transport_assigned_by);
  assert.ok(pickup.transport_assigned_at);
  const notes = (await request('/notifications', { client: 'colleague' })).data.notifications;
  assert.ok(notes.some((n) => n.title === 'Entrega concluída' && n.lot_id === lotId));
  assert.ok(
    notes.some((n) => n.title === 'Responsável pelo transporte definido' && n.lot_id === lotId),
  );
});

test('ONG pode publicar, aparecer no diretório e participar das negociações', async () => {
  const created = await request('/lots', {
    client: 'ngo',
    method: 'POST',
    body: {
      title: 'Alumínio da cooperativa',
      material: 'Alumínio',
      weight: 1,
      price: 6.5,
      quality: 'Separado e limpo',
      description: 'Material proveniente da coleta seletiva da nossa comunidade.',
    },
  });
  assert.equal(created.status, 201);
  const directory = (await request('/organizations?type=ngo', { client: 'seller' })).data
    .organizations;
  assert.ok(directory.some((org) => org.name === 'ONG Teste' && org.active_lots === 1));
  assert.equal(
    (
      await request(`/lots/${created.data.lot.id}/proposals`, {
        client: 'seller',
        method: 'POST',
        body: { price: 6.2 },
      })
    ).status,
    201,
  );
});

test('marcar notificações como lidas é compartilhado, mas isolado por organização', async () => {
  assert.equal(
    (await request('/notifications/read', { client: 'colleague', method: 'PATCH', body: {} }))
      .status,
    200,
  );
  assert.ok(
    (await request('/notifications', { client: 'seller' })).data.notifications.every(
      (n) => n.is_read === 1,
    ),
  );
  assert.ok(
    (await request('/notifications', { client: 'buyer' })).data.notifications.some(
      (n) => n.is_read === 0,
    ),
  );
});

test('perfil valida senha atual, atualiza o login e encerra outras sessões', async () => {
  await login('seller2', 'ana@horizonte.com.br');
  assert.equal(
    (
      await request('/profile', {
        client: 'seller',
        method: 'PATCH',
        body: {
          name: 'Ana Paula',
          email: 'ana@horizonte.com.br',
          newPassword: 'Nova@1234',
          currentPassword: 'incorreta',
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/profile', {
        client: 'seller',
        method: 'PATCH',
        body: {
          name: 'Ana Teste',
          email: 'ana.teste@example.test',
          newPassword: 'Nova@1234',
          currentPassword: 'Demo@123',
        },
      })
    ).status,
    200,
  );
  assert.equal((await request('/auth/me', { client: 'seller2' })).status, 401);
  assert.equal((await request('/auth/me', { client: 'seller' })).status, 200);
  assert.equal(
    (
      await request('/auth/login', {
        client: 'newLogin',
        method: 'POST',
        body: { email: 'ana.teste@example.test', password: 'Nova@1234' },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/auth/logout', { client: 'newLogin', method: 'POST', body: {} })).status,
    200,
  );
  assert.equal((await request('/auth/me', { client: 'newLogin' })).status, 401);
});
