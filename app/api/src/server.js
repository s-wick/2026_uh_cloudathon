// Entry point: loads task metadata, seeds the store, listens, drains on SIGTERM.
const { createApp } = require('./app');
const { createStore } = require('./store');
const { loadMeta } = require('./meta');

const SHUTDOWN_TIMEOUT_MS = 25_000;

async function main() {
  const meta = await loadMeta();
  const store = createStore();

  // A data outage must not stop the task from starting; /api/seed can retry later.
  try {
    const seeded = await store.seedIfEmpty();
    if (seeded > 0) console.log(JSON.stringify({ msg: 'seeded catalog', seeded, store: store.kind }));
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'seed failed', error: err.message }));
  }

  const app = createApp({ store, meta, serveWeb: process.env.SERVE_WEB === '1' });
  const port = Number(process.env.PORT) || 8080;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({ msg: 'listening', port, taskId: meta.taskId, az: meta.az, store: store.kind }));
  });
  // Longer than the ALB idle timeout (60 s), so the ALB closes idle connections first.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ msg: 'shutting down', signal }));
    // Stop accepting connections; in-flight requests finish, then exit.
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => {
      console.error(JSON.stringify({ level: 'error', msg: 'shutdown timed out' }));
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(JSON.stringify({ level: 'error', msg: 'startup failed', error: err.message }));
  process.exit(1);
});
