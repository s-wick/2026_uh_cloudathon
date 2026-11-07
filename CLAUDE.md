# AnyCompany Cloudathon POC

Hackathon project: migrate and modernize one legacy app (StoreOps) to AWS using CDK. Start with `plan/00-overview.md`; work through `plan/01` to `plan/05` in order and update the status table in `00-overview.md` as phases finish.

## Stack

- IaC: AWS CDK, TypeScript, in `cdk/`.
- API: Node.js 24 + Express 5 in `app/api`, container on ECS Fargate (ARM64). Test: `cd app/api && npm test` (memory store); `npm run test:dynamo` runs the same tests against DynamoDB Local on port 8000 (setup in `plan/01-sample-app.md`). Local page: `SERVE_WEB=1 npm start`, then http://localhost:8080.
- Web: static HTML/JS in `app/web`, served by S3 + CloudFront.
- Data: DynamoDB, on-demand.
- Docs: `docs/` (draw.io diagram, report, story).

## AWS access

- Profile `hackathon`, region `us-west-2`, account `811428812009`. Credentials are temporary and come from `.env`; refresh with `/sync-aws-creds` (see `.claude/commands/`).
- Run AWS CLI as `aws ... --profile hackathon`.
- The existing `vscodeserver` stack is the lab's dev box. Do not modify or delete it.

## Rules

- Never read, print, or commit `.env`, `*.pem`, `ec2`, `fingerprint`, `SSH.md`. They are in `.gitignore` and denied in `.claude/settings.json`.
- Ask before `cdk destroy`, deleting AWS resources, or any other irreversible step.
- Keep the POC small: no features beyond what a demo beat needs. Cuts are listed in `plan/00-overview.md`.
- Figures about AnyCompany's current costs are assumptions; label them "illustrative". AWS costs come from the Pricing Calculator.
- Commit only when the user asks.
