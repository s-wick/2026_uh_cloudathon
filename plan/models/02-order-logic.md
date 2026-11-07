# 02 - Order placement logic (flowchart)

What `POST /api/orders` does, and which HTTP status each path returns. Source: `plan/01-sample-app.md`.

```mermaid
flowchart TD
    start([POST /api/orders]) --> parse{Body is JSON?}
    parse -->|No| bad[400 Bad Request]
    parse -->|Yes| sku{sku exists in catalog?}
    sku -->|No| bad
    sku -->|Yes| qty{qty integer 1 to 10?}
    qty -->|No| bad
    qty -->|Yes| tx[[TransactWriteItems]]
    tx --> upd["Update PRODUCT: stock minus qty, condition stock >= qty"]
    tx --> put["Put ORDER item with gsi1pk = ORDERS"]
    upd --> ok{Transaction committed?}
    put --> ok
    ok -->|Yes| created([201 Created, order JSON])
    ok -->|Cancelled| conflict([409 Conflict, stock unchanged])
```

The memory store (used locally when `TABLE_NAME` is unset) follows the same rules, so the tests check one contract for both stores.
