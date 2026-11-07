# Handoff: Cloudathon POC, start phase 1 (sample app)
Written 2026-11-07 on branch `main` in C:\Users\Admin\Desktop\2026_uh_cloudathon.

## Goal
The user is at a university cloud hackathon (https://www.ist.uh.edu/programs/cloudathon). The scenario: AnyCompany Corporation (Houston retailer) must leave its on-premises virtualization platform. The user must deliver a migrated and modernized proof-of-concept app on AWS, deployed with infrastructure as code, plus an architecture diagram (draw.io), a Well-Architected report with a summary of at most three pages, a live demo, and a pitch to judges. Time is very tight (under 3 hours). The user wants a story along the lines of "a legacy app is costing millions; we migrate it to save cost and cut overhead".

## State
Done and verified:
- AWS CLI profile `hackathon` (us-west-2) now holds the temporary credentials from `.env`. `aws sts get-caller-identity --profile hackathon` returned role `WSParticipantRole`, account `811428812009`. The profile originally had only a region and no keys; that was the "bug".
- Planning files written (not committed): `CLAUDE.md`, `.gitignore`, `.claude/settings.json`, `.claude/commands/sync-aws-creds.md`, and `plan/00-overview.md` through `plan/05-story-and-pitch.md`. `git status` shows only these as untracked, so `.gitignore` is hiding the secret files as intended.
- A read-only look at the account found one EC2 instance and one CloudFormation stack, both from the lab's own `vscodeserver` stack (a VS Code server on EC2 behind CloudFront). No CDKToolkit stack exists, so the account is not CDK-bootstrapped.

Not started: everything in phases 1 to 5. No app code, no CDK code, no docs exist yet. Phase 1 is the current focus.

Unverified:
- Whether Node, npm, Docker and the CDK CLI are installed on this laptop (only `aws-cli/2.39.6` was seen).
- Whether the lab role may run `cdk bootstrap` or create CloudFront, ALB, ECS and DynamoDB resources.
- Whether the deny rules in `.claude/settings.json` use valid syntax (written from memory, never exercised).

## Decisions (user-approved, do not reopen)
- TypeScript AWS CDK; ECS Fargate (ARM64) for the API; small three-tier demo: static web on S3 + CloudFront, API on Fargate behind an ALB, DynamoDB on-demand.
- Very tight time, so the plan keeps the minimal slice. Cuts: no Aurora/RDS, WAF, custom domain, multi-region, CI/CD, EKS.
- The story is called "The VM Tax". The app name StoreOps and its "about 12 VMs of a roughly 400-VM fleet" size are invented; label them "illustrative scenario". Current-state cost figures are assumptions; AWS-side costs must come from the AWS Pricing Calculator.
- The user asked to focus on the sample app first, then work through the numbered plan files, and to create `.claude` files as work goes.

## Constraints and preferences
- The user wants to switch to Opus 5.5 at high effort before building; they run `/model` themselves.
- Never read, print or commit `.env`, `*.pem`, `ec2`, `fingerprint`, `SSH.md`. Ask before `cdk destroy` or any other irreversible step. Commit only when asked.
- Do not modify or delete the lab's `vscodeserver` stack.

## Gotchas
- `.env` has CRLF line endings; strip them (`tr -d '\r'`) before sourcing in bash.
- Credentials are temporary and will expire. Re-sync with the commands in `.claude/commands/sync-aws-creds.md`.
- `ws-default-keypair.pem` is not attached to the lab instance (its KeyName is None), so SSH with that key will probably fail. Access is via the CloudFront VS Code URL or SSM. This matters only if the CDK deploy has to run from that box because Docker is missing locally.
- A CDK `ContainerImage.fromAsset` build needs Docker and a bootstrapped account.

## Next steps
1. Read `plan/00-overview.md` and `plan/01-sample-app.md`.
2. Run the read-only probe: `node -v`, `npm -v`, `docker version`.
3. Build the sample app per `plan/01-sample-app.md` under `app/api` and `app/web`. Make `npm test` pass and check the page locally with `SERVE_WEB=1 npm start`.
4. Update the status table in `plan/00-overview.md`, then move to `plan/02-cdk-infrastructure.md`.
5. Add `.claude` files as useful, for example a settings entry or command for the local test run.

## Open questions
- Do the user or the judges have real cost figures for the story, or should placeholders stay labelled as assumptions?
- Is Docker usable locally, or should the build and deploy run on the lab VS Code server?

## Pointers
- Plan files: `plan/00-overview.md` to `plan/05-story-and-pitch.md`; original approved plan at `C:\Users\Admin\.claude\plans\i-am-at-a-tender-hammock.md`.
- CloudFront URL of the lab VS Code server and instance details are in the untracked `ec2` file (blocked for reading by the deny rules; ask the user if needed).
- The Cloudathon problem statement is summarized in `plan/00-overview.md`; the user has the full text.
