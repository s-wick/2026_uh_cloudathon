# 01 - Request flow (sequence)

How a shopper's browser talks to the system: page load, cached catalog, live stock, and placing an order. Source: `plan/01-sample-app.md` (API contract) and `plan/02-cdk-infrastructure.md` (edge behaviours).

```mermaid
sequenceDiagram
    title StoreOps request flow
    participant Browser
    participant CloudFront
    participant S3
    participant ALB
    participant Fargate
    participant DynamoDB

    Browser->>CloudFront: GET / (HTTPS)
    CloudFront->>S3: Fetch index.html, app.js (OAC)
    S3-->>CloudFront: Static files
    CloudFront-->>Browser: Page

    Browser->>CloudFront: GET /api/products
    CloudFront->>ALB: Cache miss, forward
    ALB->>Fargate: Route to healthy task on 8080
    Fargate->>DynamoDB: Scan PRODUCT items
    DynamoDB-->>Fargate: Catalog
    Fargate-->>CloudFront: 200, s-maxage=30
    CloudFront-->>Browser: Catalog, x-cache Miss
    Browser->>CloudFront: GET /api/products again
    CloudFront-->>Browser: Catalog from edge, x-cache Hit

    Browser->>CloudFront: GET /api/stock
    CloudFront->>ALB: Forward, never cached
    ALB->>Fargate: Route
    Fargate->>DynamoDB: Read stock
    DynamoDB-->>Fargate: Stock per SKU
    Fargate-->>Browser: 200 no-store

    Browser->>CloudFront: POST /api/orders sku, qty
    CloudFront->>ALB: Forward
    ALB->>Fargate: Route
    Fargate->>DynamoDB: TransactWriteItems, stock >= qty
    DynamoDB-->>Fargate: Committed or cancelled
    Fargate-->>Browser: 201 order, or 409 out of stock
```

Things to notice:

- Only `/api/products` is cached at the edge (30 s). Stock and orders always reach the API.
- Every response carries `x-served-by` (task id) and `x-app-version`, so `curl -i` shows load balancing and rolling deploys.
- `/api/health` is used only by the ALB and never touches DynamoDB.
