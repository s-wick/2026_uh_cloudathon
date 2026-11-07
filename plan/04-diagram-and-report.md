# 04 - Architecture diagram and report

Status: not started. Can run in parallel with phase 3 once phase 2 is written. Time budget: about 50 minutes.

## Diagram: `docs/architecture.drawio`

draw.io XML using the `mxgraph.aws4.*` shape library (AWS Architecture icons), exported to `docs/architecture.png` for the slides.

Contents: users and remote regions, CloudFront, S3 (web), Application Load Balancer, two availability zones each with a private subnet running Fargate tasks, NAT gateway, DynamoDB, ECR, CloudWatch, and an "automation" lane showing CDK to CloudFormation. A separate faded lane shows the fleet migration tooling (Application Discovery Service, Migration Hub, Application Migration Service, AWS Transform) as the roadmap, clearly marked "not deployed in POC".

## Report: `docs/report.md`

Convert to PDF or docx for submission. Structure:

1. **Summary (at most three pages)**: problem, proposed architecture, how each pain point is addressed, cost position, reuse across the fleet, next steps.
2. **Well-Architected assessment**: a table for each of the six pillars (operational excellence, security, reliability, performance efficiency, cost optimization, sustainability): design choice, why, trade-off, gap and next step.
3. **Pain point mapping**: the eight customer pain points from the brief, each with the feature that answers it and the demo beat that proves it.
4. **Cost and fleet model**: per-workload run cost from the AWS Pricing Calculator for the deployed configuration, scaled across the fleet with the assumptions table from `docs/story.md`. Current-state numbers are labelled illustrative.
5. **Migration approach for the rest of the fleet**: discovery, wave planning, rehost then modernize, the reusable `ThreeTierWorkload` construct, and tools to name (Application Discovery Service, Migration Hub, Application Migration Service, AWS Transform).
6. **Deliberate cuts and roadmap**: from `00-overview.md`.

## Done when

Diagram opens in draw.io with AWS icons, the summary fits three pages when exported, and every claim in the report is either demonstrated, derived from the Pricing Calculator, or labelled as an assumption.
