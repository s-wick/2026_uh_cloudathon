// Picks the data store: DynamoDB when TABLE_NAME is set, memory otherwise.
// The DynamoDB module is required lazily so local runs never load the AWS SDK.
function createStore(env = process.env) {
  if (env.TABLE_NAME) return require('./store-dynamo').createDynamoStore(env.TABLE_NAME);
  return require('./store-memory').createMemoryStore();
}

module.exports = { createStore };
