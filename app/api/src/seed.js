// Sample catalog. Source of truth for SKUs, names and prices; `stock` is the
// initial stock written by seedIfEmpty. Prices are fictional.
const CATALOG = [
  { sku: 'AA-24', name: 'AA battery 24-pack', priceCents: 1499, emoji: '🔋', stock: 200 },
  { sku: 'USBC-65', name: '65W USB-C charger', priceCents: 3999, emoji: '🔌', stock: 80 },
  { sku: 'EARBUDS', name: 'Wireless earbuds', priceCents: 7999, emoji: '🎧', stock: 50 },
  { sku: 'CASE-X', name: 'Phone case', priceCents: 1999, emoji: '📱', stock: 120 },
  { sku: 'RC-CAR', name: 'RC car kit', priceCents: 12999, emoji: '🏎️', stock: 20 },
  { sku: 'SOLDER', name: 'Soldering iron set', priceCents: 4999, emoji: '🛠️', stock: 35 },
  { sku: 'PLUG', name: 'Smart plug', priceCents: 2499, emoji: '💡', stock: 150 },
  { sku: 'PWRBANK', name: 'Power bank 20000mAh', priceCents: 4499, emoji: '⚡', stock: 90 },
];

const BY_SKU = new Map(CATALOG.map((p) => [p.sku, p]));

module.exports = { CATALOG, BY_SKU };
