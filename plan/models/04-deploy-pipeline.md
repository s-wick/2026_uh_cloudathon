# 04 - Deploy pipeline (flowchart)

What happens between `cdk deploy` and a new version serving traffic, including the automatic rollback. Source: `plan/02-cdk-infrastructure.md` and `plan/03-deploy-and-verify.md`.

```mermaid
flowchart LR
    dev[/Developer runs cdk deploy/] --> synth[[cdk synth: TypeScript to CloudFormation]]
    synth --> boot{Account bootstrapped?}
    boot -->|No| bootstrap[cdk bootstrap, once]
    bootstrap --> build
    boot -->|Yes| build[Docker buildx linux/arm64]
    build --> ecr[(ECR image)]
    build --> web[Upload app/web to S3]
    ecr --> cfn[CloudFormation change set]
    web --> cfn
    cfn --> svc[ECS starts new tasks, up to 200 percent]
    svc --> health{New tasks pass /api/health?}
    health -->|Yes| shift[ALB shifts traffic, old tasks drain 30s]
    shift --> done([New version live, zero failed requests])
    health -->|No| breaker[Circuit breaker trips]
    breaker --> rollback([Automatic rollback to last good version])
```

Prerequisites on the laptop: Node, Docker running, AWS credentials for account `811428812009` in `us-west-2`. If Docker is missing, deploy from the lab VS Code server.
