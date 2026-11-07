// In-memory store used when TABLE_NAME is unset (local runs and tests).
// Same interface and error behaviour as store-dynamo.js.
const { CATALOG } = require('./seed');
const { outOfStock, newOrder, productView, orderView } = require('./model');

function createMemoryStore() {
  const products = new Map(); // sku -> item including stock
  const orders = []; // newest first

  return {
    kind: 'memory',

    async seedIfEmpty() {
      let seeded = 0;
      for (const p of CATALOG) {
        if (!products.has(p.sku)) {
          products.set(p.sku, { ...p });
          seeded++;
        }
      }
      return seeded;
    },

    async listProducts() {
      return [...products.values()].map(productView);
    },

    async getStock() {
      return Object.fromEntries([...products.values()].map((p) => [p.sku, p.stock]));
    },

    async placeOrder(product, qty) {
      const item = products.get(product.sku);
      if (!item || item.stock < qty) throw outOfStock();
      item.stock -= qty;
      const order = newOrder(product, qty);
      orders.unshift(order);
      return order;
    },

    async listOrders(limit = 20) {
      return orders.slice(0, limit).map(orderView);
    },
  };
}

module.exports = { createMemoryStore };
