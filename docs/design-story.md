# StoreOps design story

Living log of every design choice in this project: what we picked, why, what it costs us.
Short on purpose. One entry per choice. Newest at the bottom of its phase.

**Entry shape**

```
### D<n>. <choice in a few words>
- **Pick:** what we did.
- **Why:** reason, tied to a pain point or constraint.
- **Cost:** what we give up. "None" is allowed.
```

IDs never change. Report, pitch and code comments can cite them ("see D16").

---

## Setting

AnyCompany (Houston retailer) must leave its on-prem VM platform: lease ends Q4 2027, licence renewal costs several times more, small platform team. We migrate and modernize one app as proof. Under 3 hours.

---

## Phase 0: planning

Decided in planning. Infrastructure parts (D6 to D9) get built in phase 2.

### D1. Story: "The VM Tax"
- **Pick:** one legacy app, StoreOps (order and inventory portal), is the canary. Same pattern retires the rest of the fleet.
- **Why:** judges remember a story, not a service list. Every demo beat answers one pain point from the brief.
- **Cost:** StoreOps, its "about 12 VMs" and the "about 400-VM fleet" are invented. Always labelled "illustrative scenario".

### D2. Smallest honest three-tier slice
- **Pick:** web, API, database. Nothing else.
- **Why:** under 3 hours. Three tiers is the minimum that shows independent scaling, self-healing and zero-downtime deploys.
- **Cost:** cut for time, listed in the report as next steps: Aurora/RDS, WAF, custom domain (Route 53 + ACM), multi-region, CI/CD pipeline, EKS.

### D3. Infrastructure as code: AWS CDK in TypeScript
- **Pick:** CDK, TypeScript, in `cdk/`.
- **Why:** brief requires IaC. CDK gives high-level constructs (load-balanced Fargate service in one call), so less code in little time. User's choice.
- **Cost:** account needs `cdk bootstrap` once. Image builds need Docker.

### D4. API compute: ECS Fargate
- **Pick:** containers on Fargate. Not EC2, not EKS.
- **Why:** no servers or OS to patch, which kills the "3 people patch 400 VMs" pain. EKS too heavy for 3 hours and a small team.
- **Cost:** less control than EC2. Per-vCPU price higher than a fully used EC2 instance.

### D5. ARM64 (Graviton) containers
- **Pick:** Fargate tasks on ARM64.
- **Why:** cheaper per vCPU-hour than x86 for the same work. Node runs the same on both.
- **Cost:** image must be built for `linux/arm64`. On an x86 laptop, Docker emulates (slower build).

### D6. Database: DynamoDB on-demand
- **Pick:** one DynamoDB table, pay per request, point-in-time recovery on.
- **Why:** no instances, no patching, multi-AZ by default, ready in seconds. Pay only for traffic.
- **Cost:** no SQL joins. Access patterns designed up front (D15). Aurora cut (D2).

### D7. Web on S3 + CloudFront; API through the same CloudFront
- **Pick:** static page in a private S3 bucket. CloudFront serves it, and routes `/api/*` to the load balancer.
- **Why:** remote customers on slow links get edge caching and TLS near them. One domain for page and API, so no CORS.
- **Cost:** CloudFront to load balancer is plain HTTP in the POC. HTTPS to origin is a next step.

### D8. Two Availability Zones, at least 2 tasks, 1 NAT gateway
- **Pick:** VPC across 2 AZs. Load balancer in both. At least 2 API tasks, spread across AZs. Tasks in private subnets.
- **Why:** an Availability Zone is a separate data center. One AZ down, app stays up. Today AnyCompany runs from one building: single point of failure.
- **Cost:** 1 NAT gateway is itself a single point for outbound traffic. Production: 2 NATs or VPC endpoints. NAT bills hourly, so tear down after judging.

### D9. Reusable construct `ThreeTierWorkload` (planned for phase 2)
- **Pick:** whole stack as one parameterized CDK construct. StoreOps is one instance.
- **Why:** proves "same approach for the rest of the fleet". Next app is one more instance, one command.
- **Cost:** a bit more upfront structure than a single flat stack.

### D10. Numbers rule
- **Pick:** AnyCompany's current costs are assumptions in an editable table, labelled "illustrative". AWS costs come from the AWS Pricing Calculator only.
- **Why:** judges punish invented numbers presented as fact.
- **Cost:** savings claim is a model, not a measurement.

### D11. Secrets never in the repo
- **Pick:** `.env`, `*.pem`, `ec2`, `fingerprint`, `SSH.md` in `.gitignore` and denied in `.claude/settings.json`. Temporary lab credentials live in AWS CLI profile `hackathon`.
- **Why:** a public repo with lab keys is a security finding, and a judged one.
- **Cost:** credentials expire. Re-sync with `/sync-aws-creds`.

---

## Phase 1: sample app

### D12. Node.js 24, not 20
- **Pick:** Node.js 24 (`node:24-alpine`).
- **Why:** Node 20 reached end of life April 2026. No security fixes. A judge would flag it.
- **Cost:** none. Same code runs on 22+.

### D13. Express 5
- **Pick:** Express 5 for the API.
- **Why:** smallest familiar web framework. Version 5 sends errors from async routes to the error handler by itself, so no wrapper code.
- **Cost:** none for a POC.

### D14. In-memory store when `TABLE_NAME` is unset
- **Pick:** same store interface, two versions: DynamoDB (AWS) and memory (local).
- **Why:** run and test the app with no AWS account, no network, no cost. AWS SDK not even loaded locally.
- **Cost:** two implementations to keep in step. Same test suite runs on both (D25), so drift shows up.

### D15. Single-table data model
- **Pick:** one table, key `pk`. Products `PRODUCT#<sku>`, orders `ORDER#<id>`. Index `gsi1` (`gsi1pk = ORDERS`, sorted by `createdAt`) for "latest 20 orders".
- **Why:** every screen is one cheap key lookup or one index query. No scans.
- **Cost:** new access patterns may need a new index.

### D16. Placing an order is one transaction
- **Pick:** one DynamoDB transaction: lower stock only if enough is left, and write the order. Not enough stock: HTTP 409.
- **Why:** two shoppers buying the last item can never both succeed. No overselling, no half-written orders.
- **Cost:** transactions cost about twice a normal write. Fine at this scale.

### D17. Catalog in code, stock in the database
- **Pick:** SKUs, names, prices in `app/api/src/seed.js`. DynamoDB holds stock. Products read by key (BatchGetItem), never by scanning.
- **Why:** catalog is small and fixed for the demo. A scan would also read every order and get slower and pricier over time.
- **Cost:** changing the catalog means a redeploy. Real system: catalog moves into the database.

### D18. Health check never touches the database
- **Pick:** `GET /api/health` answers from the process only.
- **Why:** if the database hiccups, a DB-backed health check would mark every container unhealthy and the load balancer would kill them all. Outage gets worse.
- **Cost:** health check does not prove the database works. Alarms cover that.

### D19. Graceful shutdown, timed to the load balancer
- **Pick:** on SIGTERM, stop taking new connections, finish in-flight requests, exit within 25 s. Load balancer drains for 30 s. Keep-alive timeout 65 s, longer than the load balancer's 60 s idle timeout.
- **Why:** rolling deploys and scale-in with zero failed requests. Keep-alive order avoids random 502 errors.
- **Cost:** a deploy takes about 30 s longer per batch of tasks.

### D20. Every response says who served it
- **Pick:** headers `x-served-by` (container id) and `x-app-version` on every response, including errors.
- **Why:** load balancing, self-healing and rolling deploys become visible with plain `curl -i` or the demo panel.
- **Cost:** exposes internal task ids. Fine for a demo. Production: drop or hash.

### D21. CPU-burn endpoint, demo only
- **Pick:** `GET /api/work?ms=N` busy-loops up to 2000 ms.
- **Why:** autoscaling demo needs real CPU load on demand.
- **Cost:** anyone can burn CPU. Capped. Remove or protect outside the demo.

### D22. Seed on startup: idempotent, never fatal
- **Pick:** each container writes the catalog only if missing. A seed failure is logged; container still starts. `POST /api/seed` retries.
- **Why:** fresh table works with no manual step. Many containers starting at once cannot double-seed. Database blip does not crash-loop the service.
- **Cost:** none.

### D23. Small, non-root container
- **Pick:** two-stage build, production dependencies only, runs as user `node`, starts `node` directly (no npm wrapper).
- **Why:** smaller image, less attack surface. Node receives SIGTERM directly, so D19 works.
- **Cost:** none.

### D24. Plain web page, no framework
- **Pick:** vanilla HTML, CSS, JS. No build step. Relative URLs. Content set with `textContent`, never `innerHTML`.
- **Why:** nothing to build or break. Same files work locally and behind CloudFront. `textContent` blocks script injection.
- **Cost:** hand-written DOM code. Fine for one page.

### D25. Tests: built-in runner, two databases
- **Pick:** `node:test`, zero test dependencies. `npm test` uses the memory store. `npm run test:dynamo` runs the same 7 tests against DynamoDB Local in Docker, one fresh table per test.
- **Why:** catches key, index and transaction bugs before spending deploy time. Test setup refuses any endpoint that is not `localhost`, so it can never create or delete tables in real AWS.
- **Cost:** DynamoDB Local does not test IAM permissions or real latency. Phase 3 covers those.

### D26. Demo panel explains itself
- **Pick:** panel split into labelled beats: Last request, Load balancing, Autoscaling, Edge cache. Each has a one-line explanation. Load balancing shows a table: container, Availability Zone, version, request count with share bar, failed-request count. A container silent for 3 s while others answer fades and reads "stopped responding". Reset button between beats.
- **Why:** first version was one cryptic line. Judges must read the result from across the room: even split = load balancing, faded row plus new row = self-healing, new version rows with 0 failed = zero-downtime deploy.
- **Cost:** a little more page code.

### D27. Git: one branch and PR per phase
- **Pick:** work on a phase branch, open a PR into `main`, test plan as checkboxes in the PR.
- **Why:** reviewable history. PR test plan shows judges what was proven and what was not.
- **Cost:** none.

---

## Phase 2: CDK infrastructure

### D28. CDK project by hand, versions pinned
- **Pick:** no `cdk init`. `aws-cdk-lib` 2.275.0 and CLI 2.1148.0 as local dependencies, TypeScript 5.9 via ts-node.
- **Why:** CDK CLI not installed globally. Pinned versions: same synth on every laptop. No unused init boilerplate (Jest, sample test).
- **Cost:** none.

### D29. Load balancer reachable only from CloudFront
- **Pick:** ALB listener open only to AWS's CloudFront origin-facing prefix list. Tasks accept only the ALB on 8080.
- **Why:** nobody can skip the edge and hit the API directly. One security group rule, no extra service.
- **Cost:** direct `curl` to the ALB times out; test through CloudFront. Any CloudFront distribution could still reach it. Next step: secret origin header or CloudFront VPC origin with an internal ALB.

### D30. Product list cached at the edge, origin decides how long
- **Pick:** `/api/products` behaviour with a custom cache policy, TTL min 0, default 0, max 5 min. The app sends `s-maxage=30`. All other `/api/*` paths: caching off, all methods, viewer headers forwarded except Host.
- **Why:** edge-hit demo. Cache time lives in app code next to the data it describes. Orders and stock changes never cached.
- **Cost:** stock shown can be up to 30 s old. Order placement re-checks stock in the transaction (D16), so no overselling.

### D31. Autoscaling on CPU, request count as backup
- **Pick:** 2 to 10 tasks. Target 50% CPU, and 1000 requests per task per minute. Scale out after 30 s, scale in after 120 s.
- **Why:** `/api/work` (D21) drives CPU for the demo. Fast scale-out shows on stage. Slow scale-in avoids flapping.
- **Cost:** may run more tasks than needed for 2 minutes after a spike.

### D32. Small tasks: 0.25 vCPU, 512 MiB
- **Pick:** smallest Fargate size that fits Node comfortably.
- **Why:** cheapest per task. Scaling adds tasks, not bigger tasks. Small tasks also hit 50% CPU fast for the demo.
- **Cost:** one burst request (`/api/work`) can hold a whole task's CPU.

### D33. Fast health checks
- **Pick:** `/api/health` every 10 s, 2 failures mark a task unhealthy, 2 passes mark it healthy. Drain 30 s (D19).
- **Why:** self-healing demo: a stopped task leaves the pool in about 20 s, a new one joins in about 20 s after it starts.
- **Cost:** a little more health-check traffic. Negligible.

### D34. Lab teardown is one command
- **Pick:** table, bucket and log group set to delete with the stack; bucket empties itself. VPC default security group stripped of rules.
- **Why:** lab account, NAT and ALB bill hourly (D8). `cdk destroy` leaves nothing behind.
- **Cost:** production must flip table and bucket to retain. Point-in-time recovery stays on regardless.

### D35. CloudFront price class 100
- **Pick:** edge locations in North America and Europe only.
- **Why:** AnyCompany is a Houston retailer; its customers are in the US. Cheapest class.
- **Cost:** slower for viewers in Asia or South America. One setting to change.

### D36. Alarms without notifications
- **Pick:** two alarms. 5 or more 5xx responses (ALB plus tasks) in a minute. Any unhealthy task for 2 minutes. No SNS topic.
- **Why:** shows the monitoring story in the console during the demo. Missing data counts as OK, so a quiet app stays green.
- **Cost:** nobody gets paged. Production: SNS to the on-call channel.

### D37. App version from CDK context
- **Pick:** `APP_VERSION` defaults to `v1`; `npx cdk deploy -c appVersion=v2` rolls out v2.
- **Why:** rolling-deploy demo with no code change and no file edit. New value, new task definition, ECS replaces tasks 2 at a time with rollback on failure.
- **Cost:** version is not tied to a git commit. Real pipeline: image tag from the commit SHA.

### D38. Logs kept one week
- **Pick:** API log group retention 1 week.
- **Why:** enough to debug the demo. Logs never kept forever by accident (CloudWatch default).
- **Cost:** no long-term audit trail. Production: longer retention or export to S3.
