// StoreOps page. Vanilla JS; relative URLs so it works locally and behind CloudFront.
const $ = (id) => document.getElementById(id);
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// Every call goes through here so the demo panel shows task, version, RTT and edge cache status.
async function api(path, init) {
  const t0 = performance.now();
  const res = await fetch(path, init);
  const rtt = Math.round(performance.now() - t0);
  $('d-rtt').textContent = `${rtt} ms (${path})`;
  $('d-task').textContent = res.headers.get('x-served-by') ?? '-';
  $('d-version').textContent = res.headers.get('x-app-version') ?? '-';
  $('d-cache').textContent = res.headers.get('x-cache') ?? 'n/a (no CloudFront)';
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.error ?? res.statusText), { status: res.status });
  return body;
}

let products = [];

async function loadProducts() {
  products = await api('/api/products');
  await refreshStock();
}

async function refreshStock() {
  const stock = await api('/api/stock');
  const list = $('products');
  list.replaceChildren(
    ...products.map((p) => {
      const left = stock[p.sku] ?? 0;
      const buy = el('button', { type: 'button', textContent: 'Buy', disabled: left < 1 });
      buy.setAttribute('aria-label', `Buy one ${p.name}`);
      buy.addEventListener('click', () => placeOrder(p, buy));
      return el(
        'li',
        { className: 'card' },
        el('span', { className: 'emoji', ariaHidden: 'true', textContent: p.emoji }),
        el('h3', { textContent: p.name }),
        el('p', { className: 'price', textContent: money(p.priceCents) }),
        el('p', { className: 'stock', textContent: `${left} in stock` }),
        buy,
      );
    }),
  );
}

async function refreshOrders() {
  const orders = await api('/api/orders');
  const names = new Map(products.map((p) => [p.sku, p.name]));
  $('orders').replaceChildren(
    ...(orders.length
      ? orders.map((o) =>
          el('li', {
            textContent: `${new Date(o.createdAt).toLocaleTimeString()} - ${o.qty} x ${names.get(o.sku) ?? o.sku} - ${money(o.totalCents)}`,
          }),
        )
      : [el('li', { className: 'empty', textContent: 'No orders yet.' })]),
  );
}

async function placeOrder(product, button) {
  button.disabled = true;
  const status = $('order-status');
  try {
    await api('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku: product.sku, qty: 1 }),
    });
    status.textContent = `Ordered 1 x ${product.name}.`;
  } catch (err) {
    status.textContent = err.status === 409 ? `${product.name} is out of stock.` : `Order failed: ${err.message}`;
  }
  await Promise.all([refreshStock(), refreshOrders()]).catch(() => {});
}

async function refreshInfo() {
  const info = await api('/api/info');
  $('d-az').textContent = info.az;
  $('d-store').textContent = info.store;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Start/stop button that runs `step` repeatedly while on. Each start gets its
// own token, so a quick stop-then-start never leaves two loops running.
function toggleLoop(button, step, { start, stop }) {
  let current = null;
  button.textContent = start;
  button.addEventListener('click', async () => {
    if (current) {
      current.stopped = true;
      current = null;
    } else {
      const me = { stopped: false };
      current = me;
      (async () => {
        while (!me.stopped) await step().catch(() => sleep(500));
      })();
    }
    button.textContent = current ? stop : start;
    button.classList.toggle('running', Boolean(current));
  });
}

// Burn CPU: four parallel 500 ms burns at a time, to push the service over its CPU target.
toggleLoop($('burn'), () => Promise.all([1, 2, 3, 4].map(() => api('/api/work?ms=500'))), {
  start: 'Burn CPU',
  stop: 'Stop burning CPU',
});

// Load balancing: ask "who are you?" about 5 times a second and tally answers per container.
// A container that has not answered for STALE_MS while others still do is marked as stopped
// (task killed, or replaced by a deploy). Failed requests are counted for the zero-downtime claim.
const STALE_MS = 3000;
const containers = new Map(); // taskId -> { taskId, az, version, count, lastSeen }
let failures = 0;

function renderContainers() {
  const rows = [...containers.values()];
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const newest = Math.max(0, ...rows.map((r) => r.lastSeen));
  $('lb-summary').textContent = total || failures ? `${total} answered, ${failures} failed` : '';
  $('lb-table').hidden = rows.length === 0;
  $('lb-rows').replaceChildren(
    ...rows.map((r) => {
      const share = Math.round((100 * r.count) / total);
      const stale = newest - r.lastSeen > STALE_MS;
      const bar = el('span', { className: 'bar' });
      bar.style.width = `${share}%`;
      return el(
        'tr',
        { className: stale ? 'stale' : '' },
        el('td', { textContent: r.taskId.slice(0, 8) }),
        el('td', { textContent: r.az }),
        el('td', { textContent: r.version }),
        el(
          'td',
          {},
          `${r.count} (${share}%)`,
          bar,
          stale ? el('span', { className: 'note', textContent: 'stopped responding' }) : '',
        ),
      );
    }),
  );
}

toggleLoop(
  $('spam'),
  async () => {
    try {
      const info = await api('/api/info');
      const row = containers.get(info.taskId) ?? { taskId: info.taskId, az: info.az, version: info.version, count: 0 };
      row.count++;
      row.lastSeen = Date.now();
      containers.set(info.taskId, row);
    } catch {
      failures++;
    }
    renderContainers();
    await sleep(200);
  },
  { start: 'Start', stop: 'Stop' },
);

$('lb-reset').addEventListener('click', () => {
  containers.clear();
  failures = 0;
  renderContainers();
});

$('edge').addEventListener('click', () => api('/api/products').catch(() => {}));

async function init() {
  try {
    await loadProducts();
    await Promise.all([refreshOrders(), refreshInfo()]);
  } catch (err) {
    $('order-status').textContent = `Could not reach the API: ${err.message}`;
  }
  // Keep stock and version current (shows rolling deploys without a reload).
  setInterval(() => Promise.all([refreshStock(), refreshInfo()]).catch(() => {}), 5000);
}

init();
