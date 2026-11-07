# Models

Diagrams that explain the StoreOps POC. Each file holds Mermaid source, which GitHub renders, plus short notes. The same diagrams are on the FigJam board "Cloudathon - AWS Target Architecture", next to the main architecture view.

| # | Model | Type | Answers |
|---|---|---|---|
| 00 | [Services overview](00-services-overview.png) | Image (PNG) | Start here: what each AWS service does, which pain point it solves, how a request flows |
| - | Target architecture | FigJam board | What runs where (edge, VPC, data, operations, roadmap) |
| 01 | [Request flow](01-request-flow.md) | Sequence | What happens when a shopper loads the page and buys |
| 02 | [Order logic](02-order-logic.md) | Flowchart | When the API returns 201, 400 or 409 |
| 03 | [Data model](03-data-model.md) | ER diagram | What is stored in DynamoDB and how it is queried |
| 04 | [Deploy pipeline](04-deploy-pipeline.md) | Flowchart | What `cdk deploy` does, and how rollback works |
| 05 | [Task lifecycle](05-task-lifecycle.md) | State diagram | How tasks self-heal, scale and drain |
| 06 | [Pain point to proof map](06-demo-proof-map.md) | Flowchart | Which demo beat proves which claim |
| 07 | [Build timeline](07-hackathon-timeline.md) | Gantt | What to work on and when |

Board: https://www.figma.com/board/rY1n7ZDfKupCfLUDy8vwSC/Cloudathon---AWS-Target-Architecture
