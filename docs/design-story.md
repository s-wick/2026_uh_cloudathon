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
