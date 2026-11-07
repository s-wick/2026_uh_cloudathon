# 05 - Story and pitch

Status: not started. Output: `docs/story.md`. Time budget: about 20 minutes.

## Narrative: "The VM Tax"

Real facts from the brief: AnyCompany Corporation, Houston, about 5,100 employees, electronics, phones, hobby equipment and batteries, data-center lease ends Q4 2027, virtualization licensing renewing at several times the old cost, small platform team.

Invented for the story (label "illustrative scenario" on every slide that uses it): the app is **StoreOps**, an order and inventory portal on about 12 VMs (4 web, 4 app, 2 database, 2 batch), one of roughly 400 VMs.

## Five-minute arc

1. **Hook**: StoreOps is eating the budget; licensing multiplies, the lease clock runs out, and a few people patch hundreds of VMs by hand.
2. **Villains**: each pain point from the brief, named once.
3. **Decision**: do not lift-and-hold on another VM platform. Move and modernize in one motion, automated.
4. **Approach**: discover, plan waves, rehost or replatform, modernize. The POC proves the landing zone with CDK.
5. **Live demo**: the six beats in [03-deploy-and-verify.md](03-deploy-and-verify.md), 30 to 45 seconds each.
6. **Money**: per-workload run cost, then times the fleet; three buckets shrink: licence plus colo and hardware, patching and scaling labour, idle over-provisioned capacity.
7. **Close**: wave plan to beat Q4 2027; the ask is to approve wave 1.

## `docs/story.md` must contain

- Speaker script with timings per section.
- Demo run-sheet: exact commands that worked in phase 3, in order, with expected output.
- Assumptions table (editable): old and renewed licence cost, colo, hardware refresh, FTE patching labour, incident cost, VM count. Every value marked "assumed" unless the user supplies a real number.
- Fleet cost model skeleton that reads from the assumptions table and the Pricing Calculator result.
- Likely judge questions with short answers (why Fargate over EKS or EC2, why DynamoDB, data migration path, security, what breaks first at 10x load, what would change for a stateful or Windows workload).

## Done when

The script fits five minutes when read aloud, and no number appears on a slide without an "assumed" or "calculator" label.
