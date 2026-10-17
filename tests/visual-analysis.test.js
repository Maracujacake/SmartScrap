import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';

let db,
  app,
  server,
  url,
  failNext = false;
const root = resolve('data', `visual-test-${randomUUID()}`),
  cookies = {};
const fakeJpeg = Buffer.from([255, 216, 255, ...Array(30).fill(0)]);
const lot = {
  title: 'Retalhos de aço com análise',
  material: 'Aço',
  weight: 2,
  price: 1.3,
  quality: 'Aço carbono declarado',
  description: 'Retalhos selecionados e armazenados em local coberto.',
};
async function request(
  path,
  { client = 'seller', method = 'GET', body, raw = false, headers = {} } = {},
) {
  const response = await fetch(`${url}/api${path}`, {
    method,
    headers: {
      'Content-Type': raw ? 'application/octet-stream' : 'application/json',
      ...(cookies[client] ? { cookie: cookies[client] } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : raw
          ? new Blob([new Uint8Array(body)])
          : JSON.stringify(body),
  });
  if (response.headers.get('set-cookie'))
    cookies[client] = response.headers.get('set-cookie').split(';')[0];
  return { status: response.status, data: await response.json() };
}
async function create(material = 'Aço', count = 1) {
  const response = await request('/visual-analyses', {
    method: 'POST',
    body: { material, photos: Array.from({ length: count }, (_, i) => `foto-${i}.jpg`) },
  });
  assert.equal(response.status, 201);
  return response.data.analysis.id;
}
async function upload(id, position = 0) {
  const response = await request(`/visual-analyses/${id}/photos/${position}`, {
    method: 'PUT',
    body: fakeJpeg,
    raw: true,
  });
  assert.equal(response.status, 200);
}
async function finish(id) {
  assert.equal(
    (await request(`/visual-analyses/${id}/start`, { method: 'POST', body: {} })).status,
    202,
  );
  for (let i = 0; i < 100; i++) {
    const response = await request(`/visual-analyses/${id}`);
    if (['completed', 'failed'].includes(response.data.analysis.status))
      return response.data.analysis;
    await new Promise((done) => setTimeout(done, 10));
  }
  assert.fail('Análise não terminou.');
}
before(async () => {
  await mkdir(root, { recursive: true });
  db = createDatabase(':memory:');
  app = createApp(db, {
    email: { env: {}, autoStart: false },
    visualAnalysis: {
      root,
      runner: async (job) => {
        if (failNext) {
          failNext = false;
          throw new Error('Falha simulada no modelo.');
        }
        for (let i = 0; i < job.photo_count; i++) {
          await writeFile(join(job.directory, `photo-${i}.jpg`), fakeJpeg);
          await writeFile(join(job.directory, `photo-${i}_mask.png`), 'test-mask');
          await writeFile(join(job.directory, `photo-${i}_overlay.png`), 'test-overlay');
        }
        const steel = ['Aço', 'Ferro'].includes(job.material);
        return {
          scope: steel ? 'steel_corrosion' : 'unsupported_material',
          photos: Array.from({ length: job.photo_count }, (_, position) => ({
            position,
            corrosion_predicted_percent_pixels: 7,
            classes: [],
          })),
        };
      },
    },
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  url = `http://127.0.0.1:${server.address().port}`;
  for (const [client, email] of [
    ['seller', 'ana@horizonte.com.br'],
    ['colleague', 'pedro@horizonte.com.br'],
    ['buyer', 'lucas@ecometal.com.br'],
    ['carrier', 'carla@transportes.example'],
  ])
    assert.equal(
      (
        await request('/auth/login', {
          client,
          method: 'POST',
          body: { email, password: 'Demo@123' },
        })
      ).status,
      200,
    );
});
after(async () => {
  app.locals.email.close();
  app.locals.visualAnalysis.close();
  await new Promise((done) => server.close(done));
  db.close();
  assert.ok(root.startsWith(resolve('data') + '\\') || root.startsWith(resolve('data') + '/'));
  await rm(root, { recursive: true, force: true });
});

test('fotos exigem sessão, limites, arquivo de imagem e todas as posições antes de iniciar', async () => {
  assert.equal((await request('/visual-analyses/status', { client: 'anonymous' })).status, 401);
  assert.equal(
    (
      await request('/visual-analyses', {
        method: 'POST',
        body: { material: 'Aço', photos: ['1', '2', '3', '4'] },
      })
    ).status,
    400,
  );
  const id = await create('Aço', 3);
  assert.equal(
    (
      await request(`/visual-analyses/${id}/photos/0`, {
        method: 'PUT',
        body: fakeJpeg,
        raw: true,
        client: 'anonymous',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(`/visual-analyses/${id}/photos/0`, {
        method: 'PUT',
        body: Buffer.from('arquivo que não é imagem'),
        raw: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/visual-analyses/${id}/photos/0`, {
        method: 'PUT',
        body: fakeJpeg,
        raw: true,
        headers: { 'sec-fetch-site': 'cross-site' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/visual-analyses/${id}/photos/0`, {
        method: 'PUT',
        body: Buffer.alloc(8 * 1024 * 1024 + 1),
        raw: true,
      })
    ).status,
    413,
  );
  await upload(id);
  assert.equal(
    (await request(`/visual-analyses/${id}/start`, { method: 'POST', body: {} })).status,
    409,
  );
  await upload(id, 1);
  await upload(id, 2);
  assert.equal((await finish(id)).status, 'completed');
  assert.equal(
    (await request(`/visual-analyses/${id}/photos/0`, { method: 'PUT', body: fakeJpeg, raw: true }))
      .status,
    409,
  );
});

test('análise privada compartilhada na organização, revisão obrigatória e publicação atômica', async () => {
  const id = await create();
  await upload(id);
  const analysis = await finish(id);
  assert.equal(analysis.status, 'completed');
  assert.equal((await request(`/visual-analyses/${id}`, { client: 'buyer' })).status, 404);
  assert.equal((await request(`/visual-analyses/${id}`, { client: 'colleague' })).status, 200);
  assert.equal(
    (
      await fetch(`${url}${analysis.photos[0].original_url}`, {
        headers: { cookie: cookies.buyer },
      })
    ).status,
    404,
  );
  const body = { ...lot, visualAnalysisId: id };
  const before = db.prepare('SELECT COUNT(*) AS count FROM lots').get().count;
  assert.equal((await request('/lots', { method: 'POST', body })).status, 400);
  assert.equal(
    (
      await request('/lots', {
        method: 'POST',
        body: { ...body, visualReview: 'disagree', visualNotes: 'não' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/lots', {
        method: 'POST',
        body: { ...body, material: 'Cobre', visualReview: 'agree' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/lots', {
        method: 'POST',
        client: 'buyer',
        body: { ...body, visualReview: 'agree' },
      })
    ).status,
    404,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM lots').get().count, before);
  const saved = await request('/lots', {
    method: 'POST',
    client: 'colleague',
    body: {
      ...body,
      visualReview: 'disagree',
      visualNotes: 'O fundo pintado foi confundido com corrosão.',
    },
  });
  assert.equal(saved.status, 201);
  assert.equal(
    (await request('/lots', { method: 'POST', body: { ...body, visualReview: 'agree' } })).status,
    409,
  );
  const detail = (await request(`/lots/${saved.data.lot.id}`, { client: 'buyer' })).data
    .visualAnalysis;
  assert.equal(detail.operator_verdict, 'disagree');
  assert.equal(detail.reviewed_by_name, 'Pedro Santos');
  assert.equal(detail.result.photos[0].corrosion_predicted_percent_pixels, 7);
  assert.match(detail.operator_notes, /fundo pintado/);
  const image = await fetch(`${url}${detail.photos[0].original_url}`, {
    headers: { cookie: cookies.buyer },
  });
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /image\/jpeg/);
  assert.equal(
    (await request(`/visual-analyses/${id}`, { method: 'DELETE', body: {} })).status,
    409,
  );
  assert.equal(
    (await request(`/visual-analyses/${id}/start`, { method: 'POST', body: {} })).status,
    409,
  );
});

test('falhas são visíveis e permitem nova tentativa; descarte é limitado a rascunhos', async () => {
  const id = await create();
  await upload(id);
  failNext = true;
  const failed = await finish(id);
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /Falha simulada/);
  assert.equal((await finish(id)).status, 'completed');
  assert.equal(
    (await request(`/visual-analyses/${id}`, { method: 'DELETE', client: 'buyer', body: {} }))
      .status,
    404,
  );
  assert.equal(
    (await request(`/visual-analyses/${id}`, { method: 'DELETE', body: {} })).status,
    200,
  );
  assert.equal((await request(`/visual-analyses/${id}`)).status, 404);
  await assert.rejects(readFile(join(root, id, 'photo-0.jpg')));
});

test('outros metais guardam fotos sem uma classificação de corrosão inventada', async () => {
  const id = await create('Cobre');
  await upload(id);
  const analysis = await finish(id);
  assert.equal(analysis.result.scope, 'unsupported_material');
  assert.equal(analysis.photos[0].mask_url, null);
  assert.equal(
    (
      await fetch(`${url}/api/visual-analyses/${id}/images/0/mask`, {
        headers: { cookie: cookies.seller },
      })
    ).status,
    404,
  );
  const saved = await request('/lots', {
    method: 'POST',
    body: {
      ...lot,
      material: 'Cobre',
      visualAnalysisId: id,
      visualNotes: 'Cobre separado manualmente.',
    },
  });
  assert.equal(saved.status, 201);
  assert.equal(
    (await request(`/lots/${saved.data.lot.id}`)).data.visualAnalysis.operator_verdict,
    'not_applicable',
  );
});

test('transportadora consulta fotografias somente enquanto atribuída ao frete', async () => {
  const analysisId = await create();
  await upload(analysisId);
  await finish(analysisId);
  const saved = await request('/lots', {
    method: 'POST',
    body: { ...lot, visualAnalysisId: analysisId, visualReview: 'agree' },
  });
  assert.equal(saved.status, 201);
  const lotId = saved.data.lot.id;
  assert.equal(
    (await request(`/visual-analyses/${analysisId}`, { client: 'carrier' })).status,
    404,
  );
  assert.equal(
    (
      await request('/visual-analyses', {
        client: 'carrier',
        method: 'POST',
        body: { material: 'Aço', photos: ['teste.jpg'] },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/lots/${lotId}/proposals`, {
        client: 'buyer',
        method: 'POST',
        body: { price: 1.25 },
      })
    ).status,
    201,
  );
  const proposal = (await request(`/lots/${lotId}`)).data.proposals[0];
  assert.equal(
    (await request(`/proposals/${proposal.id}`, { method: 'PATCH', body: { status: 'accepted' } }))
      .status,
    200,
  );
  const pickup = (await request('/pickups')).data.pickups.find((p) => p.lot_id === lotId);
  const company = (await request('/transport-companies')).data.companies.find(
    (c) => c.name === 'Exemplo Transporters LTDA',
  );
  const fields = { transportCompanyId: company.id, distanceKm: 100, freightPayer: 'buyer' };
  const quote = (
    await request(`/pickups/${pickup.id}/freight-quote`, { method: 'POST', body: fields })
  ).data.quote;
  assert.equal(
    (
      await request(`/pickups/${pickup.id}`, {
        method: 'PATCH',
        body: {
          ...fields,
          transportKind: 'external',
          confirmFreight: true,
          quoteToken: quote.quoteToken,
        },
      })
    ).status,
    200,
  );
  const analysis = (await request(`/visual-analyses/${analysisId}`, { client: 'carrier' })).data
    .analysis;
  assert.equal(
    (
      await fetch(`${url}${analysis.photos[0].original_url}`, {
        headers: { cookie: cookies.carrier },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/pickups/${pickup.id}`, { method: 'PATCH', body: { transportKind: 'seller' } }))
      .status,
    200,
  );
  assert.equal(
    (await request(`/visual-analyses/${analysisId}`, { client: 'carrier' })).status,
    404,
  );
  assert.equal(
    (
      await fetch(`${url}${analysis.photos[0].original_url}`, {
        headers: { cookie: cookies.carrier },
      })
    ).status,
    404,
  );
});
