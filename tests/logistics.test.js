import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';

async function fixture() {
  const db = createDatabase(':memory:');
  const app = createApp(db, { email: { env: {}, autoStart: false } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`,
    cookies = {};
  async function request(client, path, method = 'GET', body) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', cookie: cookies[client] || '' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie'))
      cookies[client] = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  }
  for (const [client, email] of [
    ['seller', 'ana@horizonte.com.br'],
    ['buyer', 'lucas@ecometal.com.br'],
    ['other', 'marina@alumitech.com.br'],
    ['carrier', 'carla@transportes.example'],
    ['colleague', 'pedro@horizonte.com.br'],
  ])
    assert.equal(
      (await request(client, '/auth/login', 'POST', { email, password: 'Demo@123' })).status,
      200,
    );
  async function trade() {
    const published = await request('seller', '/lots', 'POST', {
      title: 'Lote de aço com transporte',
      material: 'Aço',
      weight: 25,
      price: 1.25,
      description: 'Material separado para testar o fluxo de transporte.',
    });
    assert.equal(published.status, 201);
    const lot = published.data.lot;
    assert.equal(
      (await request('buyer', `/lots/${lot.id}/proposals`, 'POST', { price: 1.25 })).status,
      201,
    );
    const proposal = (await request('seller', `/lots/${lot.id}`)).data.proposals[0];
    assert.equal(
      (await request('seller', `/proposals/${proposal.id}`, 'PATCH', { status: 'accepted' }))
        .status,
      200,
    );
    return (await request('seller', '/pickups')).data.pickups.find((p) => p.lot_id === lot.id);
  }
  const company = (await request('carrier', '/transport/profile')).data.company;
  const quoteBody = { transportCompanyId: company.id, distanceKm: 100, freightPayer: 'buyer' };
  async function confirm(pickup, client = 'seller', fields = {}) {
    const body = { ...quoteBody, ...fields };
    const result = await request(client, `/pickups/${pickup.id}/freight-quote`, 'POST', body);
    assert.equal(result.status, 200);
    const saved = await request(client, `/pickups/${pickup.id}`, 'PATCH', {
      ...body,
      transportKind: 'external',
      confirmFreight: true,
      quoteToken: result.data.quote.quoteToken,
    });
    assert.equal(saved.status, 200);
    return result.data.quote;
  }
  return {
    db,
    app,
    request,
    trade,
    company,
    quoteBody,
    confirm,
    async close() {
      app.locals.email.close();
      app.locals.visualAnalysis.close();
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

test('transportadora cadastra equipe e tarifas próprias, sem publicar ou comprar lotes', async () => {
  const f = await fixture();
  try {
    const registered = await f.request('new', '/auth/register', 'POST', {
      name: 'Pessoa transporte',
      email: 'nova@fretes.example',
      password: 'Teste@123',
      organizationName: 'Nova Transportadora',
      organizationType: 'carrier',
      city: 'Campinas',
      state: 'SP',
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.data.user.organization_type, 'carrier');
    assert.ok(registered.data.user.transport_company_id);
    const joined = await f.request('joined', '/auth/register', 'POST', {
      name: 'Colega transporte',
      email: 'colega@fretes.example',
      password: 'Teste@123',
      inviteCode: registered.data.user.invite_code,
    });
    assert.equal(joined.data.user.transport_company_id, registered.data.user.transport_company_id);
    assert.equal((await f.request('new', '/lots', 'POST', {})).status, 403);
    assert.equal((await f.request('new', '/lots/1/proposals', 'POST', { price: 1 })).status, 403);
    assert.equal((await f.request('new', '/lots/1')).status, 403);
    assert.equal((await f.request('new', '/dashboard')).status, 403);
    assert.equal((await f.request('seller', '/transport/profile')).status, 403);
    assert.equal(
      (
        await f.request('new', '/transport/rates', 'PUT', {
          rates: [{ material: 'Aço', pricePerKgKm: 0.000001, minimumFreight: 20 }],
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request('joined', '/transport/profile')).data.rates[0].pricePerKgKm,
      0.000001,
    );
    for (const rates of [
      [{ material: 'Aço', pricePerKgKm: 0 }],
      [{ material: 'Aço', pricePerKgKm: 0.0000001 }],
      [{ material: 'Madeira', pricePerKgKm: 1 }],
      [
        { material: 'Aço', pricePerKgKm: 1 },
        { material: 'Aço', pricePerKgKm: 2 },
      ],
    ])
      assert.equal((await f.request('new', '/transport/rates', 'PUT', { rates })).status, 400);
    assert.equal(
      (await f.request('new', '/transport/profile')).data.rates[0].pricePerKgKm,
      0.000001,
    );
  } finally {
    await f.close();
  }
});

test('frete soma ao material, tem confirmação unilateral e alimenta métricas apenas na conclusão', async () => {
  const f = await fixture();
  try {
    const pickup = await f.trade();
    assert.equal(
      (await f.request('other', `/pickups/${pickup.id}/freight-quote`, 'POST', f.quoteBody)).status,
      403,
    );
    assert.equal(
      (
        await f.request('seller', `/pickups/${pickup.id}`, 'PATCH', {
          transportKind: 'external',
          transportCompanyId: f.company.id,
          status: 'scheduled',
          scheduledDate: '2099-01-01',
        })
      ).status,
      400,
    );
    const quote = await f.confirm(pickup, 'buyer');
    assert.equal(quote.freightCents, 50000);
    assert.equal(quote.materialCents, 3125000);
    assert.equal(quote.finalTotalCents, 3175000);
    let carrierPickups = (await f.request('carrier', '/pickups')).data.pickups;
    assert.equal(carrierPickups.length, 1);
    assert.equal(carrierPickups[0].freight_payer, 'buyer');
    assert.equal((await f.request('carrier', `/lots/${pickup.lot_id}`)).status, 200);
    assert.equal(
      (await f.request('carrier', `/pickups/${pickup.id}`, 'PATCH', { transportKind: 'seller' }))
        .status,
      403,
    );
    let stats = (await f.request('carrier', '/transport/dashboard')).data.stats;
    assert.equal(stats.completedFreightCents, 0);
    assert.equal(stats.activeJobs, 1);
    assert.equal(stats.contractedFreightCents, 50000);
    for (const body of [
      { status: 'scheduled', scheduledDate: '2099-01-01' },
      { status: 'transit' },
      { status: 'delivered' },
    ])
      assert.equal(
        (await f.request('carrier', `/pickups/${pickup.id}`, 'PATCH', body)).status,
        200,
      );
    stats = (await f.request('carrier', '/transport/dashboard')).data.stats;
    assert.equal(stats.transportedTonnes, 25);
    assert.equal(stats.deliveredLots, 1);
    assert.equal(stats.completedFreightCents, 50000);
    assert.equal(stats.distanceKm, 100);
    assert.equal(stats.activeJobs, 0);
    assert.equal(
      (await f.request('seller', `/pickups/${pickup.id}`, 'PATCH', { transportKind: 'buyer' }))
        .status,
      409,
    );
    assert.equal(
      (await f.request('seller', `/pickups/${pickup.id}/freight-quote`, 'POST', f.quoteBody))
        .status,
      409,
    );
  } finally {
    await f.close();
  }
});

test('orçamento rejeita tarifa desatualizada, respeita mínimo e preserva preço confirmado', async () => {
  const f = await fixture();
  try {
    const pickup = await f.trade();
    const initial = (
      await f.request('seller', `/pickups/${pickup.id}/freight-quote`, 'POST', f.quoteBody)
    ).data.quote;
    assert.equal(
      (
        await f.request('carrier', '/transport/rates', 'PUT', {
          rates: [{ material: 'Aço', pricePerKgKm: 0.0004, minimumFreight: 150 }],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.request('seller', `/pickups/${pickup.id}`, 'PATCH', {
          ...f.quoteBody,
          transportKind: 'external',
          confirmFreight: true,
          quoteToken: initial.quoteToken,
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.request('seller', '/pickups')).data.pickups.find((p) => p.id === pickup.id)
        .transport_kind,
      null,
    );
    const quote = await f.confirm(pickup, 'seller', { freightPayer: 'seller' });
    assert.equal(quote.freightCents, 100000);
    assert.equal(
      (
        await f.request('carrier', '/transport/rates', 'PUT', {
          rates: [{ material: 'Aço', pricePerKgKm: 0.0008, minimumFreight: 300 }],
        })
      ).status,
      200,
    );
    let saved = (await f.request('seller', '/pickups')).data.pickups.find(
      (p) => p.id === pickup.id,
    );
    assert.equal(saved.freight_cents, 100000);
    assert.equal(saved.freight_rate_micros, 400);
    assert.equal(saved.freight_payer, 'seller');
    const minimum = (
      await f.request('seller', `/pickups/${pickup.id}/freight-quote`, 'POST', {
        ...f.quoteBody,
        distanceKm: 0.1,
      })
    ).data.quote;
    assert.equal(minimum.freightCents, 30000);
    for (const distanceKm of [0, -1, Infinity, 20001, 0.123])
      assert.equal(
        (
          await f.request('seller', `/pickups/${pickup.id}/freight-quote`, 'POST', {
            ...f.quoteBody,
            distanceKm,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await f.request('seller', `/pickups/${pickup.id}/freight-quote`, 'POST', {
          ...f.quoteBody,
          freightPayer: 'other',
        })
      ).status,
      400,
    );
    assert.equal(
      (await f.request('seller', `/pickups/${pickup.id}`, 'PATCH', { transportKind: 'buyer' }))
        .status,
      200,
    );
    saved = (await f.request('seller', '/pickups')).data.pickups.find((p) => p.id === pickup.id);
    assert.equal(saved.freight_cents, 0);
    assert.equal(saved.freight_confirmed_by, null);
    assert.equal(saved.final_total_cents, 3125000);
    assert.equal((await f.request('carrier', '/pickups')).data.pickups.length, 0);
    assert.equal((await f.request('carrier', `/lots/${pickup.lot_id}`)).status, 403);
    assert.equal(
      (
        await f.request('carrier', `/pickups/${pickup.id}`, 'PATCH', {
          status: 'scheduled',
          scheduledDate: '2099-01-01',
        })
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});

test('e-mails são registrados na transação, privados por usuário e aceitam endereços de teste', async () => {
  const f = await fixture();
  try {
    const pickup = await f.trade();
    const seller = (await f.request('seller', '/emails')).data;
    assert.equal(seller.configured, false);
    assert.equal(seller.messages.length, 2);
    assert.ok(
      seller.messages.every(
        (m) => m.status === 'pending' && m.recipient === 'ana@horizonte.com.br',
      ),
    );
    assert.equal((await f.request('colleague', '/emails')).data.messages.length, 1);
    assert.equal((await f.request('buyer', '/emails')).data.messages.length, 1);
    assert.equal((await f.request('other', '/emails')).data.messages.length, 0);
    assert.equal(
      (await f.request('buyer', `/lots/${pickup.lot_id}/proposals`, 'POST', { price: 1 })).status,
      409,
    );
    assert.equal((await f.request('buyer', '/emails')).data.messages.length, 1);
    assert.equal((await f.request('seller', '/lots', 'POST', { title: 'Inválido' })).status, 400);
    assert.equal((await f.request('seller', '/emails')).data.messages.length, 2);
  } finally {
    await f.close();
  }
});
