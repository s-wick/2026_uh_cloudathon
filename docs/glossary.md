<!-- For human readers. Agents: skip this file unless asked to edit it. It is excluded from search via the root `.ignore` file. -->

# Glossary

Plain-language explanations of the cloud terms used in this project. Where it helps, each entry says where the term shows up in StoreOps.

## The cloud basics

- **AWS region:** a geographic area where AWS has data centers. We use `us-west-2` (Oregon).
- **Availability Zone (AZ):** one or more separate data centers inside a region, each with its own power and network. Running in two AZs means one can fail without taking the app down. `us-west-2a` and `us-west-2b` are two of them.
- **VPC (Virtual Private Cloud):** your own private network inside AWS. Nothing gets in or out unless you allow it.
- **Subnet:** a section of the VPC. A *public* subnet can be reached from the internet, for example by the load balancer. A *private* subnet cannot; our app containers live there.
- **Internet gateway:** the door between the VPC and the internet, used by the public subnets.
- **NAT gateway:** a one-way door. Machines in private subnets can call out (for example to download updates) but nobody outside can call in.
- **VPC endpoint:** a private connection from the VPC straight to an AWS service such as S3 or DynamoDB, without going through the NAT gateway or the internet.
- **Security group:** a firewall around a resource that lists who may connect to it, and on which port.
- **Prefix list:** a named list of IP address ranges. AWS publishes one with all CloudFront server addresses, and we allow only that list into the load balancer.
- **Port:** a numbered channel on a machine. Web traffic uses 80 (HTTP) and 443 (HTTPS). Our app listens on 8080.
- **HTTPS / TLS:** encrypted web traffic. CloudFront handles the encryption for visitors.

## Running the app

- **Container:** the app packaged together with everything it needs to run, so it behaves the same on a laptop and in AWS.
- **Docker image:** the packaged file a container starts from. CDK builds ours from `app/api/Dockerfile`.
- **ECR (Elastic Container Registry):** AWS's storage for Docker images.
- **ECS (Elastic Container Service):** AWS's service that starts, stops and replaces containers.
- **Fargate:** the way of running ECS where AWS supplies the machines. We never see or patch a server.
- **Task:** one running copy of our container in ECS. We run 2 to 10.
- **Service (ECS):** the rule "keep N tasks of this app running". If a task dies, the service starts a new one.
- **ARM64 / Graviton:** AWS's own processors. They are cheaper than Intel/AMD (x86) for the same work.
- **Autoscaling:** automatically adding or removing tasks based on load, such as CPU use or request count.
- **Cooldown:** how long autoscaling waits before reacting again, so it does not overreact.
- **Rolling deploy:** replacing old tasks with new ones a few at a time, so the app never goes offline.
- **Circuit breaker / rollback:** if new tasks keep failing during a deploy, ECS stops and goes back to the previous version.

## Load balancing

- **Load balancer (ALB, Application Load Balancer):** spreads incoming requests across all healthy tasks.
- **ALB DNS name:** the web address AWS gives the load balancer (ours looks like `StoreO-Store-....elb.amazonaws.com`). Ours only answers CloudFront, so opening it directly times out.
- **DNS:** the internet's phone book, which turns names like `cloudfront.net` into server addresses.
- **Target group:** the list of tasks the load balancer sends traffic to.
- **Health check:** the load balancer regularly calls `/api/health` on each task. Tasks that stop answering are taken out of the list.
- **Draining (deregistration delay):** before a task is removed, the load balancer stops sending it new requests and gives it 30 seconds to finish the ones it has.
- **5xx error:** an HTTP error code that means "the server failed", for example 500 or 503. 4xx codes mean the request was wrong.

## Web and edge

- **S3 (Simple Storage Service):** AWS's file storage. Files live in containers called **buckets**. Our bucket holds the web page and is private.
- **CloudFront:** Amazon's content delivery network (CDN), hundreds of servers worldwide that sit between visitors and our app. Each one serves cached copies from nearby and passes everything else on to us.
- **Edge location:** one of those CloudFront server sites, close to visitors.
- **Origin:** where CloudFront fetches content it doesn't have. We have two: the S3 bucket (page) and the load balancer (API).
- **Behaviour:** a CloudFront rule matching a path such as `/api/*`, which picks the origin and the caching rules for those requests.
- **Cache hit / miss:** a *hit* is answered from CloudFront's copy; a *miss* has to go to the origin. You can see this in the `X-Cache` response header.
- **Cache policy / `Cache-Control` / `s-maxage`:** how long a copy may be kept. `s-maxage=30` is the app telling CloudFront "keep this for 30 seconds".
- **OAC (Origin Access Control):** lets CloudFront, and only CloudFront, read the private S3 bucket.
- **Price class:** which CloudFront locations are used. Fewer locations cost less.

## Data

- **DynamoDB:** AWS's fully managed database, with no servers to run. It stores items by key.
- **On-demand (pay per request):** billed per read and write instead of a fixed monthly size.
- **Partition key (`pk`):** the unique ID used to look an item up directly, for example `PRODUCT#AA-24`.
- **GSI (Global Secondary Index), `gsi1`:** a second way to look up the same data. We use it to list the latest orders by date.
- **Point-in-time recovery:** continuous backup. The table can be restored to any second in the last 35 days.
- **Transaction:** several changes that all happen or none happen. Placing an order lowers stock and records the order together.

## Security and monitoring

- **IAM (Identity and Access Management):** AWS's permission system.
- **IAM role:** a set of permissions that a service can use. The **task role** lets our containers read and write the table and nothing else.
- **CloudWatch:** AWS's monitoring service, for metrics, logs and alarms.
- **Alarm:** a rule that watches a metric and changes state (OK or ALARM) when a threshold is crossed.
- **Log group:** where a service's log lines are stored.

## Infrastructure as code

- **Infrastructure as code (IaC):** describing servers, networks and so on in code files instead of clicking in the console. The setup can be reviewed, repeated and deleted cleanly.
- **CloudFormation:** AWS's own IaC engine. It reads a template and creates or updates the resources it lists.
- **CDK (Cloud Development Kit):** lets us write that infrastructure in TypeScript. CDK turns it into a CloudFormation template.
- **Stack:** one group of resources that is created, updated and deleted together. Ours is `StoreOpsPoc`.
- **Construct:** a reusable CDK building block. `ThreeTierWorkload` is ours.
- **Synth:** CDK generating the CloudFormation template from our code, without touching AWS.
- **Bootstrap:** a one-time setup per account and region that creates the storage and roles CDK uses to deploy.
- **Deploy:** sending the template to CloudFormation so it creates or changes the real resources.
- **CDK context (`-c`):** a value passed in on the command line, here the app version.
- **Lambda / custom resource:** small pieces of code that CDK runs during a deploy for jobs CloudFormation cannot do by itself, such as copying web files into the bucket or emptying it before deletion.
