---
description: Synth, diff and deploy the StoreOps CDK stack (optional arg - app version, default v1)
argument-hint: "[appVersion]"
---

Deploy the `StoreOpsPoc` stack from `cdk/`. App version: `$ARGUMENTS` (use `v1` if empty).

1. Run `aws sts get-caller-identity --profile hackathon`. On `ExpiredToken`, run `/sync-aws-creds` first.
2. Check Docker is running (`docker info --format '{{.ServerVersion}}'`). The API image is built for `linux/arm64` at deploy time.
3. In `cdk/`: `npx cdk diff --profile hackathon -c appVersion=<version>`. Show the user a short summary of the changes. Stop and ask if anything is replaced or deleted (table, bucket, VPC).
4. Ask before deploying: it creates or changes billed AWS resources.
5. `npx cdk deploy --profile hackathon -c appVersion=<version> --require-approval never --outputs-file cdk-outputs.json`. Run it in the background; first deploy takes about 10 to 15 minutes (CloudFront).
6. Report the stack outputs (`Url`, `ClusterName`, `ServiceName`) and check `curl.exe -s <Url>/api/health` returns the expected version.

Never run `cdk destroy` from this command.
