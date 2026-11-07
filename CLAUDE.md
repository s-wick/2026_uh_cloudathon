# AnyCompany Cloudathon POC

Hackathon project: migrate and modernize one legacy app (StoreOps) to AWS using CDK. Start with `plan/00-overview.md`; work through `plan/01` to `plan/05` in order and update the status table in `00-overview.md` as phases finish.

## Stack

- IaC: AWS CDK, TypeScript, in `cdk/`. Check: `cd cdk && npm run build && npx cdk synth --profile hackathon`. Deploy: `/deploy [appVersion]`.
- API: Node.js 24 + Express 5 in `app/api`, container on ECS Fargate (ARM64). Test: `cd app/api && npm test` (memory store); `npm run test:dynamo` runs the same tests against DynamoDB Local on port 8000 (setup in `plan/01-sample-app.md`). Local page: `SERVE_WEB=1 npm start`, then http://localhost:8080.
- Web: static HTML/JS in `app/web`, served by S3 + CloudFront.
- Data: DynamoDB, on-demand.
- Docs: `docs/` (draw.io diagram, report, pitch story). `docs/design-story.md` is the living log of design choices (separate from the pitch story in `docs/story.md`). `docs/glossary.md` explains cloud terms for human readers; agents skip it (excluded from search via `.ignore`) unless asked to edit it.

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
- Log every design choice in `docs/design-story.md`, in the same change that makes it. A design choice is anything a teammate or judge could ask "why this?" about: a service, a library, a data shape, a default, a trade-off, a cut. Append a new `D<n>` entry under the current phase using the entry shape at the top of the file; never renumber. If a choice is reversed, add a new entry that says which one it replaces and edit the old one only to add "Replaced by D<n>". Style: terse fragments, plain words, easy for a human to skim.
