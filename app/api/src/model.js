// Domain helpers shared by both store implementations, so they return the
// same shapes and raise the same errors.
const crypto = require('node:crypto');

class StoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const outOfStock = () => new StoreError(409, 'insufficient stock');

// Time-ordered id: base36 milliseconds plus random suffix.
const newOrderId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');

function newOrder(product, qty) {
  return {
    id: newOrderId(),
    sku: product.sku,
    qty,
    totalCents: product.priceCents * qty,
    createdAt: new Date().toISOString(),
  };
}

const productView = ({ sku, name, priceCents, emoji }) => ({ sku, name, priceCents, emoji });
const orderView = ({ id, sku, qty, totalCents, createdAt }) => ({ id, sku, qty, totalCents, createdAt });

module.exports = { StoreError, outOfStock, newOrder, productView, orderView };
