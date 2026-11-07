// DynamoDB store. Single table, partition key `pk`, GSI `gsi1` (gsi1pk, createdAt).
//   Product: pk = PRODUCT#<sku>, sku, name, priceCents, emoji, stock
//   Order:   pk = ORDER#<id>, id, sku, qty, totalCents, createdAt, gsi1pk = ORDERS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  BatchGetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { CATALOG } = require('./seed');
const { outOfStock, newOrder, productView, orderView } = require('./model');

const productKey = (sku) => ({ pk: `PRODUCT#${sku}` });

function createDynamoStore(tableName) {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  // The catalog is small and fixed, so products are read by key (BatchGet)
  // instead of scanning a table that also holds every order.
  async function readProducts() {
    let keys = CATALOG.map((p) => productKey(p.sku));
    const bySku = new Map();
    for (let attempt = 0; keys.length > 0 && attempt < 5; attempt++) {
      const out = await doc.send(
        new BatchGetCommand({ RequestItems: { [tableName]: { Keys: keys, ConsistentRead: true } } }),
      );
      for (const item of out.Responses?.[tableName] ?? []) bySku.set(item.sku, item);
      keys = out.UnprocessedKeys?.[tableName]?.Keys ?? [];
    }
    if (keys.length > 0) throw new Error(`BatchGet left ${keys.length} keys unprocessed`);
    return CATALOG.filter((p) => bySku.has(p.sku)).map((p) => bySku.get(p.sku));
  }

  return {
    kind: 'dynamodb',

    async seedIfEmpty() {
      const results = await Promise.allSettled(
        CATALOG.map((p) =>
          doc.send(
            new PutCommand({
              TableName: tableName,
              Item: { ...productKey(p.sku), ...p },
              ConditionExpression: 'attribute_not_exists(pk)',
            }),
          ),
        ),
      );
      let seeded = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') seeded++;
        else if (r.reason?.name !== 'ConditionalCheckFailedException') throw r.reason;
      }
      return seeded;
    },

    async listProducts() {
      return (await readProducts()).map(productView);
    },

    async getStock() {
      return Object.fromEntries((await readProducts()).map((p) => [p.sku, p.stock]));
    },

    // One transaction: decrement stock only if enough is left, and write the order.
    async placeOrder(product, qty) {
      const order = newOrder(product, qty);
      try {
        await doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: tableName,
                  Key: productKey(product.sku),
                  UpdateExpression: 'SET stock = stock - :qty',
                  ConditionExpression: 'attribute_exists(pk) AND stock >= :qty',
                  ExpressionAttributeValues: { ':qty': qty },
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: { pk: `ORDER#${order.id}`, gsi1pk: 'ORDERS', ...order },
                },
              },
            ],
          }),
        );
      } catch (err) {
        const conditionFailed =
          err.name === 'TransactionCanceledException' &&
          err.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed';
        if (conditionFailed) throw outOfStock();
        throw err;
      }
      return order;
    },

    async listOrders(limit = 20) {
      const out = await doc.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'gsi1',
          KeyConditionExpression: 'gsi1pk = :p',
          ExpressionAttributeValues: { ':p': 'ORDERS' },
          ScanIndexForward: false,
          Limit: limit,
        }),
      );
      return (out.Items ?? []).map(orderView);
    },
  };
}

module.exports = { createDynamoStore };
