# 06 - Pain point to proof map (flowchart)

Each problem in the story, the AWS feature that answers it, and the live demo beat that proves it. Source: `plan/03-deploy-and-verify.md` (demo beats) and `plan/05-story-and-pitch.md`.

```mermaid
flowchart LR
    subgraph pain ["Pain point"]
        p1[Slow for remote users]
        p2[Single point of failure]
        p3[Manual scaling]
        p4[Risky deployments]
        p5[Bad releases reach users]
        p6[Hand patching VMs]
    end
    subgraph fix ["AWS feature"]
        f1[CloudFront edge cache]
        f2[ALB plus 2 or more tasks in 2 AZs]
        f3[ECS autoscaling on CPU and requests]
        f4[Rolling deploy 100 to 200 percent]
        f5[Deployment circuit breaker]
        f6[Fargate, no OS to patch, ECR images]
    end
    subgraph proof ["Demo beat"]
        d1[Second request shows x-cache Hit]
        d2[stop-task, site keeps answering]
        d3[Burn CPU, task count rises]
        d4[curl loop, zero errors, version flips]
        d5[Broken image rolls back by itself]
        d6[Rebuild image, redeploy]
    end
    p1 --> f1 --> d1
    p2 --> f2 --> d2
    p3 --> f3 --> d3
    p4 --> f4 --> d4
    p5 --> f5 --> d5
    p6 --> f6 --> d6
    style pain fill:#FFF5F5,stroke:#FF7556
    style fix fill:#F5FBFF,stroke:#3DADFF
    style proof fill:#EBFFEE,stroke:#66D575
```

The cost pain points (virtualization licence renewal, data-center lease ending Q4 2027) are answered by the fleet cost model in the report, not by a demo beat. The pain point names come from the demo-beat table in `plan/03`; check them against the exact wording of the eight pain points in the brief.
