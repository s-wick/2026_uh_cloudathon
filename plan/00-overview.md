# 00 - Overview and status

Working title: **"The VM Tax"**. One legacy application (StoreOps) is the canary; the same pattern retires the rest of the fleet.

## Goal

Deliver the Cloudathon proof of concept for AnyCompany Corporation within a very tight window (under 3 hours): a migrated and modernized three-tier application, deployed with AWS CDK (TypeScript), plus the diagram, report, and pitch.

Judged on: architecture diagram (draw.io with AWS icons), report evaluated against the Well-Architected Framework (with a summary of at most three pages), a working demo deployed in the AWS lab account, and a live presentation to AWS and industry judges.

## Fixed facts

- AWS account `811428812009`, region `us-west-2`, CLI profile `hackathon` (temporary credentials from `.env`; see `.claude/commands/sync-aws-creds.md`).
- Account is not CDK-bootstrapped yet. A lab VS Code server stack (`vscodeserver`) already exists and is not part of the solution.
- Language and compute decisions (made by the user): TypeScript CDK, ECS Fargate, small three-tier demo.

## Architecture in one picture

```
Users -> CloudFront (global edge)
           |- default  -> S3 (private, OAC)                       web tier (static)
           |- /api/*   -> ALB (2 AZ) -> ECS Fargate (>=2 tasks)    API tier
                                              |-> DynamoDB (on-demand)   data tier
```

## Phases (work in this order; each file is self-contained)

| # | File | Output | Status |
|---|------|--------|--------|
| 1 | [01-sample-app.md](01-sample-app.md) | `app/api`, `app/web`, runs locally | done |
| 2 | [02-cdk-infrastructure.md](02-cdk-infrastructure.md) | `cdk/` stack | done (v1 deployed) |
| 3 | [03-deploy-and-verify.md](03-deploy-and-verify.md) | live stack, chaos/scale/deploy proof | **current focus** |
| 4 | [04-diagram-and-report.md](04-diagram-and-report.md) | `docs/architecture.drawio`, `docs/report.md` | not started |
| 5 | [05-story-and-pitch.md](05-story-and-pitch.md) | `docs/story.md`, demo run-sheet | not started |

Update the Status column as each phase finishes.

## Deliberate cuts (list as "next steps" in the report)

Aurora/RDS, WAF, custom domain with Route 53 and ACM, multi-region, CI/CD pipeline, EKS.

## Working rules

- Never commit or print `.env`, `*.pem`, `ec2`, `fingerprint`, `SSH.md`. `.gitignore` and `.claude/settings.json` enforce this.
- Cost figures about AnyCompany's current state are assumptions and must be labelled "illustrative scenario". AWS-side figures come from the AWS Pricing Calculator.
- Tear down with `cdk destroy` after judging (the 2 NAT gateways bill hourly).
