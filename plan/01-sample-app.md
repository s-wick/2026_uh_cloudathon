# 01 - Sample app: StoreOps

Status: **current focus**. Time budget: about 25 minutes to build, 5 to verify locally.

## Purpose

StoreOps is the "legacy" order and inventory portal for AnyCompany stores. In the story it used to run on about 12 VMs; here it is the smallest app that is still honestly three-tier, so every demo beat (edge latency, self-healing, autoscaling, zero-downtime deploy) has something real to act on. It must be simple: the infrastructure is the point.

## Shape

- **Web tier**: static single page, no build step. Deployed to S3, served by CloudFront.
- **API tier**: Node.js 20 + Express in one container, runs on ECS Fargate (ARM64).
- **Data tier**: one DynamoDB table (on-demand). A tiny in-memory store is used when `TABLE_NAME` is unset, so the app runs locally with no AWS access.

```
app/
  api/
    package.json
    Dockerfile
    .dockerignore
    src/
      server.js        # starts HTTP server, SIGTERM handling
      app.js           # express app factory (testable, no listen)
      store.js         # picks DynamoDB or memory store
      store-dynamo.js
      store-memory.js
      meta.js          # task id / AZ / version lookup
      seed.js          # sample catalog
    test/app.test.js   # node:test, no extra deps
  web/
    index.html
    app.js
    styles.css
```

Dependencies (keep minimal): `express`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`. Tests use the built-in `node:test` and global `fetch`.

## API contract

All routes are under `/api` because CloudFront forwards `/api/*` to the load balancer.

| Method and path | Purpose | Notes |
|---|---|---|
| `GET /api/health` | ALB and ECS health check | Returns 200 `{status:"ok"}`. Must not touch DynamoDB, so a data outage does not kill every task. |
| `GET /api/info` | Demo panel data | `{version, taskId, az, startedAt, store}`. `version` from env `APP_VERSION`. Task and AZ from the ECS metadata endpoint (`ECS_CONTAINER_METADATA_URI_V4`), falling back to `local`. |
| `GET /api/products` | Catalog (name, price, image emoji) | Sends `Cache-Control: public, max-age=0, s-maxage=30` so CloudFront can cache it: the edge-latency demo. |
| `GET /api/stock` | Current stock per SKU | Never cached (`no-store`). Stock is the dynamic part. |
| `POST /api/orders` | Place order `{sku, qty}` | Atomically decrements stock and writes the order. 409 if insufficient stock, 400 on bad input. |
| `GET /api/orders` | Latest 20 orders | Newest first. |
| `GET /api/work?ms=N` | CPU burn for the autoscaling demo | Busy-loops N ms, N capped at 2000. Documented as demo-only. |
| `POST /api/seed` | Idempotent seed of catalog and stock | Also runs automatically on first start when the store is empty. |

Cross-cutting behaviour:

- JSON request logs, one line per request (method, path, status, duration ms, taskId), written to stdout for CloudWatch.
- Response header `x-served-by: <taskId>` and `x-app-version` on every response, so the demo shows load balancing and rolling deploys with plain `curl -i`.
- Input validation on order body (`sku` must exist, `qty` integer 1 to 10). Reject anything else with 400.
- Graceful shutdown: on `SIGTERM` stop accepting connections, finish in-flight requests, exit within 25 seconds. Needed for zero-failed-request rolling deploys.
- Listens on `PORT` (default 8080), host `0.0.0.0`.

## Data model

Single table, partition key `pk` (string), no sort key.

- Product item: `pk = "PRODUCT#<sku>"`, `name`, `priceCents`, `emoji`, `stock` (number).
- Order item: `pk = "ORDER#<ulid-ish id>"`, `sku`, `qty`, `totalCents`, `createdAt` (ISO string), `gsi1pk = "ORDERS"`.
- Listing recent orders uses a global secondary index `gsi1` (partition `gsi1pk`, sort `createdAt`), queried newest first with `Limit 20`. The CDK table (phase 2) must define this index and the env var `TABLE_NAME`.
- Order placement is one `TransactWriteItems`: `Update` on the product with `ConditionExpression stock >= :qty`, plus `Put` of the order. A cancelled transaction maps to HTTP 409.

The memory store implements the same interface (`listProducts`, `getStock`, `placeOrder`, `listOrders`, `seedIfEmpty`) with the same 409 behaviour, so the tests exercise one contract.

## Seed catalog

Matches the retailer in the brief (electronics, phones, hobby gear, batteries). Eight items is enough, for example: AA battery 24-pack, USB-C charger, wireless earbuds, phone case, RC car kit, soldering iron set, smart plug, power bank. Stock between 20 and 200. Prices are fictional and live in `seed.js`.

## Web page

One page, vanilla JS, no framework or bundler:

- Product grid with emoji, price, live stock, and a Buy button (qty 1).
- Orders list refreshed after each purchase.
- **Demo panel** (always visible, collapsible): current `version`, `taskId`, `az`, round-trip time of the last request, and whether the last request was an edge hit (`x-cache` header value). A "Burn CPU" button calls `/api/work?ms=500` repeatedly for the autoscaling demo, and a "Spam requests" toggle shows task ids changing across tasks.
- All fetches use relative URLs (`/api/...`) so the same files work locally and behind CloudFront.
- Small, accessible markup: real buttons, labels, `aria-live` region for order results.

## Container

- `FROM node:20-alpine` multi-stage: install production deps in a build stage, copy into a slim runtime stage, run as the non-root `node` user.
- Build for `linux/arm64` (Graviton Fargate). Local Windows builds use `docker buildx build --platform linux/arm64`.
- `EXPOSE 8080`. No `HEALTHCHECK` instruction needed; the load balancer and ECS task definition do health checks.
- `.dockerignore`: `node_modules`, `test`, `*.md`.

## Local run and tests

```
cd app/api
npm install
npm test                      # node --test
npm start                     # memory store on :8080
node -e "..."                 # not needed; use curl below
curl localhost:8080/api/health
curl localhost:8080/api/products
curl -X POST localhost:8080/api/orders -H "content-type: application/json" -d '{"sku":"AA-24","qty":2}'
```

Serve `app/web` locally for the page: the API app also serves `../web` statically when `SERVE_WEB=1`, which is how to try the full page without CloudFront. In AWS this variable is not set.

## Tests (node:test)

1. `GET /api/health` returns 200.
2. `GET /api/products` returns the seeded catalog and the cache header.
3. Order succeeds and decrements stock; order shows up in `GET /api/orders`.
4. Order for more than available stock returns 409 and stock is unchanged.
5. Invalid body (missing sku, qty 0, qty 11, unknown sku) returns 400.
6. Every response carries `x-served-by` and `x-app-version`.

## Acceptance criteria (phase done when all true)

- `npm test` passes.
- With `SERVE_WEB=1 npm start`, the page loads at `http://localhost:8080`, shows products, a purchase lowers stock, and the demo panel shows `local` task id.
- `docker buildx build --platform linux/arm64 -t storeops-api app/api` succeeds (if Docker is available; otherwise note it and build on the lab VS Code server in phase 3).
- No secrets, no AWS calls when `TABLE_NAME` is unset.

## Hand-off to phase 2

The CDK stack must provide: env vars `TABLE_NAME`, `APP_VERSION`, `PORT=8080`; task role with read and write on the table and `gsi1`; ALB health check path `/api/health`; deregistration delay of about 30 seconds (matches the 25 second graceful shutdown); container port 8080.
