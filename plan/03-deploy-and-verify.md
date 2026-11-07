# 03 - Deploy and verify

Status: not started. Depends on phases 1 and 2. Time budget: about 35 minutes.

## 1. Probe (read-only)

```
node -v; npm -v; docker version
aws sts get-caller-identity --profile hackathon
```

If Docker is missing on the laptop, run the CDK deploy from the lab VS Code server (CloudFront URL is in the untracked `ec2` file).

## 2. Bootstrap and deploy

```
cd cdk
npm install
npx cdk bootstrap aws://811428812009/us-west-2 --profile hackathon
npx cdk deploy --profile hackathon --require-approval never
```

Temporary credentials expire; if a call fails with `ExpiredToken`, refresh `.env` and run the `sync-aws-creds` command (`.claude/commands/sync-aws-creds.md`).

## 3. Smoke test

Replace `$CF` with the CloudFront URL from the stack output.

```
curl -i $CF/api/health
curl -i $CF/api/info
curl -i $CF/api/products          # second request should show x-cache: Hit from cloudfront
curl -i -X POST $CF/api/orders -H "content-type: application/json" -d '{"sku":"AA-24","qty":1}'
```

## 4. Demo beats (each doubles as proof)

| Beat | Action | Pass condition |
|---|---|---|
| Edge latency | Request `/api/products` and the page twice | `x-cache: Hit from cloudfront` on the second |
| Single point of failure | `aws ecs list-tasks`, then `aws ecs stop-task` on one | Site keeps answering; service returns to desired count |
| Manual scaling | Hammer `/api/work?ms=500` with a loop or `hey` | `desiredCount` rises above 2 within a few minutes, falls back after |
| Risky deployment | Bump `APP_VERSION`, redeploy while a curl loop runs | Zero non-2xx responses; `x-app-version` flips |
| Bad release | Deploy an image that fails `/api/health` | Circuit breaker rolls back automatically |
| Patching | Show ECR scan results and Fargate (no OS) | Findings visible; fix = rebuild image |

## 5. Teardown (after judging, not before)

`npx cdk destroy --profile hackathon`. Confirm with the user before destroying.

## Done when

All six beats were observed once and the exact commands that worked are copied into `docs/story.md`.
