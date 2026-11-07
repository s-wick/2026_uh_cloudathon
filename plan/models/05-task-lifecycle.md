# 05 - Fargate task lifecycle (state diagram)

The states one API task goes through. This is what the self-healing, autoscaling, and zero-downtime demo beats show. Source: `plan/01-sample-app.md` (graceful shutdown) and `plan/02-cdk-infrastructure.md` (service settings).

```mermaid
stateDiagram-v2
    direction LR
    Provisioning: Provisioning (pull image from ECR)
    Starting: Starting (seed if table empty)
    Healthy: Healthy (in ALB target group)
    Unhealthy: Unhealthy (failed /api/health)
    Draining: Draining (SIGTERM, finish in-flight, 30s)
    Stopped: Stopped
    [*] --> Provisioning: scale out or deploy
    Provisioning --> Starting
    Starting --> Healthy: health check passes
    Starting --> Unhealthy: health check fails
    Healthy --> Unhealthy: crash or hang
    Healthy --> Draining: scale in, new deploy, or stop-task
    Unhealthy --> Stopped: ECS replaces it
    Draining --> Stopped
    Stopped --> [*]
```

The service keeps between 2 and 10 tasks running. When one stops for any reason, ECS starts a replacement to get back to the desired count.
