# 02 - CDK infrastructure

Status: not started. Depends on phase 1. Time budget: about 40 minutes.

## Layout

```
cdk/
  bin/app.ts                      # env: account 811428812009, region us-west-2
  lib/three-tier-workload.ts      # reusable construct (the "same approach for the rest of the fleet")
  lib/poc-stack.ts                # instantiates the construct for StoreOps
  package.json, cdk.json, tsconfig.json
```

Create with `cdk init app --language typescript` inside `cdk/`, then replace the generated stack.

## Construct `ThreeTierWorkload` (props: name, apiImageDir, webDir, apiCpu, apiMemory, minTasks, maxTasks, appVersion)

1. **Network**: `ec2.Vpc` with `maxAzs: 2`, public and private-with-egress subnets, `natGateways: 1` for the POC (document 2 for production, or VPC endpoints).
2. **Data**: `dynamodb.Table`, `PAY_PER_REQUEST`, partition key `pk` (string), point-in-time recovery on, removal policy `DESTROY` for the lab. Add GSI `gsi1` (`gsi1pk` string, sort `createdAt` string).
3. **API**: `ecs_patterns.ApplicationLoadBalancedFargateService`, ARM64 (`runtimePlatform` with `CpuArchitecture.ARM64`), image from `ContainerImage.fromAsset('../app/api')`, `desiredCount: 2`, health check `/api/health`, env `TABLE_NAME`, `APP_VERSION`, `PORT`. Rolling updates with `minHealthyPercent: 100`, `maxHealthyPercent: 200`, `circuitBreaker: { rollback: true }`. Deregistration delay 30 seconds. Table `grantReadWriteData`.
4. **Autoscaling**: `service.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 10 })` with `scaleOnCpuUtilization(50)` and `scaleOnRequestCount` per target.
5. **Web**: private `s3.Bucket` (block public access, SSE), `s3deploy.BucketDeployment` from `../app/web`.
6. **Edge**: `cloudfront.Distribution`: default behaviour to S3 via `S3BucketOrigin.withOriginAccessControl`; `/api/*` to the ALB via `LoadBalancerV2Origin` (HTTP only to origin is acceptable for the POC; note HTTPS-to-origin as next step), cache disabled, origin request policy all viewer except host, allowed methods all. A second behaviour `/api/products` using a cache policy that honours origin `Cache-Control` for the edge-hit demo. Viewer protocol redirect to HTTPS. `defaultRootObject: index.html`.
7. **Observability**: log group retention 1 week, alarms on ALB 5xx and unhealthy host count (no notification target needed for the demo).
8. **Outputs**: CloudFront URL, ALB DNS name, table name, ECR/cluster/service names (used by the demo run-sheet).

## Security basics to keep (cheap and judged)

Private subnets for tasks; security groups only allow ALB to tasks on 8080; S3 not public; least-privilege task role; no secrets in code.

## Probe first (before writing the stack)

Read-only checks that decide the fallback path, run in phase 3 step 1: Docker available, Node version, whether `cdk bootstrap` is permitted. If bootstrap is denied, record it in the report and fall back to a public sample image and a pre-bootstrapped setup, stating this honestly.

## Done when

`npx cdk synth` succeeds with no errors, and the template contains the VPC, table with `gsi1`, Fargate service with autoscaling, bucket, and distribution with two origins.
