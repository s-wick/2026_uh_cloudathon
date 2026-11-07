// Express app factory. No listen() here, so tests can start it on any port.
const path = require('node:path');
const express = require('express');
const { BY_SKU } = require('./seed');
const { StoreError } = require('./model');

const MAX_WORK_MS = 2000;

function createApp({ store, meta, version = process.env.APP_VERSION || 'dev', serveWeb = false, log = true }) {
  const app = express();
  app.disable('x-powered-by');

  // Runs first, so every response (including 400s from the JSON parser) carries these headers.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.set('x-served-by', meta.taskId);
    res.set('x-app-version', version);
    if (log) {
      res.on('finish', () => {
        console.log(
          JSON.stringify({
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Number(process.hrtime.bigint() - start) / 1e6,
            taskId: meta.taskId,
          }),
        );
      });
    }
    next();
  });

  // API responses are dynamic unless a route says otherwise.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '10kb' }));

  // Health check for ALB and ECS. Never touches the data store.
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/api/info', (req, res) =>
    res.json({ version, taskId: meta.taskId, az: meta.az, startedAt: meta.startedAt, store: store.kind }),
  );

  app.get('/api/products', async (req, res) => {
    const products = await store.listProducts();
    // Browsers revalidate; CloudFront may cache for 30 s (edge-latency demo).
    res.set('Cache-Control', 'public, max-age=0, s-maxage=30');
    res.json(products);
  });

  app.get('/api/stock', async (req, res) => res.json(await store.getStock()));

  app.post('/api/orders', async (req, res) => {
    const { sku, qty } = req.body ?? {};
    const product = typeof sku === 'string' ? BY_SKU.get(sku) : undefined;
    if (!product) throw new StoreError(400, 'unknown sku');
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new StoreError(400, 'qty must be an integer from 1 to 10');
    res.status(201).json(await store.placeOrder(product, qty));
  });

  app.get('/api/orders', async (req, res) => res.json(await store.listOrders(20)));

  // Demo only: burns CPU for the autoscaling demo. Capped at MAX_WORK_MS.
  app.get('/api/work', (req, res) => {
    const requested = Number.parseInt(req.query.ms, 10);
    const ms = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), MAX_WORK_MS) : 100;
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // busy loop
    }
    res.json({ burnedMs: ms });
  });

  app.post('/api/seed', async (req, res) => res.json({ seeded: await store.seedIfEmpty() }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

  if (serveWeb) app.use(express.static(path.join(__dirname, '..', '..', 'web')));

  app.use((err, req, res, next) => {
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) {
      console.error(JSON.stringify({ level: 'error', path: req.path, error: err.message, stack: err.stack }));
    }
    res.status(status).json({ error: status >= 500 ? 'internal error' : err.message });
  });

  return app;
}

module.exports = { createApp };
