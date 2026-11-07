const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/store-memory');
const { CATALOG } = require('../src/seed');

// Starts a fresh app with a seeded memory store; returns a fetch bound to it.
async function start(t) {
  const store = createMemoryStore();
  await store.seedIfEmpty();
  const meta = { taskId: 'test-task', az: 'test-az', startedAt: new Date().toISOString() };
  const app = createApp({ store, meta, version: 'test-v', log: false });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, init) => fetch(base + path, init);
}

const postOrder = (api, body) =>
  api('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('GET /api/health returns 200', async (t) => {
  const api = await start(t);
  const res = await api('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /api/products returns the seeded catalog with the edge cache header', async (t) => {
  const api = await start(t);
  const res = await api('/api/products');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=0, s-maxage=30');
  const products = await res.json();
  assert.deepEqual(
    products.map((p) => p.sku),
    CATALOG.map((p) => p.sku),
  );
  assert.ok(products.every((p) => p.name && p.emoji && Number.isInteger(p.priceCents)));
});

test('order succeeds, decrements stock and appears in GET /api/orders', async (t) => {
  const api = await start(t);
  const before = await (await api('/api/stock')).json();

  const res = await postOrder(api, { sku: 'AA-24', qty: 2 });
  assert.equal(res.status, 201);
  const order = await res.json();
  assert.equal(order.sku, 'AA-24');
  assert.equal(order.qty, 2);
  assert.equal(order.totalCents, 2 * 1499);

  const after = await (await api('/api/stock')).json();
  assert.equal(after['AA-24'], before['AA-24'] - 2);

  const ordersRes = await api('/api/orders');
  assert.equal(ordersRes.headers.get('cache-control'), 'no-store');
  const orders = await ordersRes.json();
  assert.equal(orders[0].id, order.id);
});

test('order for more than available stock returns 409 and leaves stock unchanged', async (t) => {
  const api = await start(t);
  // RC-CAR starts at 20: two orders of 10 empty it, the third must fail.
  assert.equal((await postOrder(api, { sku: 'RC-CAR', qty: 10 })).status, 201);
  assert.equal((await postOrder(api, { sku: 'RC-CAR', qty: 10 })).status, 201);
  const res = await postOrder(api, { sku: 'RC-CAR', qty: 1 });
  assert.equal(res.status, 409);
  const stock = await (await api('/api/stock')).json();
  assert.equal(stock['RC-CAR'], 0);
  assert.equal((await (await api('/api/orders')).json()).length, 2);
});

test('invalid order bodies return 400', async (t) => {
  const api = await start(t);
  const bad = [{ qty: 1 }, { sku: 'AA-24', qty: 0 }, { sku: 'AA-24', qty: 11 }, { sku: 'NOPE', qty: 1 }, { sku: 'AA-24', qty: 1.5 }, { sku: 'AA-24', qty: '1' }, '{not json'];
  for (const body of bad) {
    const res = await postOrder(api, body);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    assert.ok((await res.json()).error);
  }
  assert.deepEqual(await (await api('/api/orders')).json(), []);
});

test('every response carries x-served-by and x-app-version', async (t) => {
  const api = await start(t);
  const responses = [
    await api('/api/health'),
    await api('/api/info'),
    await api('/api/products'),
    await api('/api/missing'),
    await postOrder(api, { sku: 'NOPE', qty: 1 }),
    await postOrder(api, '{not json'),
  ];
  for (const res of responses) {
    assert.equal(res.headers.get('x-served-by'), 'test-task', res.url);
    assert.equal(res.headers.get('x-app-version'), 'test-v', res.url);
  }
});

test('GET /api/work burns the requested time and is never cached', async (t) => {
  const api = await start(t);
  const res = await api('/api/work?ms=5');
  assert.deepEqual(await res.json(), { burnedMs: 5 });
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
