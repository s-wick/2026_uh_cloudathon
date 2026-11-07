// One legacy VM app, modernized: CloudFront + S3 (web), ALB + Fargate ARM64 (API), DynamoDB (data).
// Reusable: the next app in the fleet is one more instance of this construct (design story D9).
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface ThreeTierWorkloadProps {
  /** Short app name, used in resource names and outputs. */
  readonly name: string;
  /** Directory with the API Dockerfile. */
  readonly apiImageDir: string;
  /** Directory with the static web files. */
  readonly webDir: string;
  /** Fargate task CPU units (256 = 0.25 vCPU). */
  readonly apiCpu: number;
  /** Fargate task memory in MiB. */
  readonly apiMemory: number;
  readonly minTasks: number;
  readonly maxTasks: number;
  /** Sent as APP_VERSION; changing it rolls out new tasks. */
  readonly appVersion: string;
}

export class ThreeTierWorkload extends Construct {
  constructor(scope: Construct, id: string, props: ThreeTierWorkloadProps) {
    super(scope, id);

    // Network: 2 AZs, tasks in private subnets, 1 NAT per AZ (D8, D39).
    // DynamoDB and S3 (ECR image layers) bypass NAT via free gateway endpoints (D39).
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 2,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'app', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
      gatewayEndpoints: {
        DynamoDb: { service: ec2.GatewayVpcEndpointAwsService.DYNAMODB },
        S3: { service: ec2.GatewayVpcEndpointAwsService.S3 },
      },
    });

    // Data: single table, contract shared with app/api/test/app.test.js (D6, D15).
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // API: Fargate ARM64 behind an ALB, rolling deploys with automatic rollback.
    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });
    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Api', {
      cluster,
      cpu: props.apiCpu,
      memoryLimitMiB: props.apiMemory,
      desiredCount: props.minTasks,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(props.apiImageDir, { platform: Platform.LINUX_ARM64 }),
        containerPort: 8080,
        environment: {
          TABLE_NAME: table.tableName,
          APP_VERSION: props.appVersion,
          PORT: '8080',
        },
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
      },
      publicLoadBalancer: true,
      openListener: false,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
    });
    table.grantReadWriteData(api.taskDefinition.taskRole);

    // Only CloudFront may reach the ALB; tasks only accept the ALB (pattern default).
    const cloudFrontOrigins = ec2.PrefixList.fromLookup(this, 'CloudFrontOriginFacing', {
      prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
    });
    api.loadBalancer.connections.allowFrom(
      ec2.Peer.prefixList(cloudFrontOrigins.prefixListId),
      ec2.Port.tcp(80),
      'CloudFront origin-facing only',
    );

    // Health check never touches the DB (D18); drain 30 s, matched to the app's 25 s shutdown (D19).
    api.targetGroup.configureHealthCheck({
      path: '/api/health',
      interval: Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
    });
    api.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '30');

    // Autoscaling: CPU first (demo uses /api/work), request count as a second signal.
    const scaling = api.service.autoScaleTaskCount({
      minCapacity: props.minTasks,
      maxCapacity: props.maxTasks,
    });
    scaling.scaleOnCpuUtilization('Cpu', {
      targetUtilizationPercent: 50,
      scaleOutCooldown: Duration.seconds(30),
      scaleInCooldown: Duration.seconds(120),
    });
    scaling.scaleOnRequestCount('Requests', {
      requestsPerTarget: 1000,
      targetGroup: api.targetGroup,
      scaleOutCooldown: Duration.seconds(30),
      scaleInCooldown: Duration.seconds(120),
    });

    // Web: private bucket, served only through CloudFront (OAC).
    const bucket = new s3.Bucket(this, 'Web', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Edge: page from S3, /api/* to the ALB. /api/products honours the app's s-maxage=30.
    const albOrigin = new origins.LoadBalancerV2Origin(api.loadBalancer, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });
    const originCacheHeaders = new cloudfront.CachePolicy(this, 'OriginCacheHeaders', {
      comment: `${props.name}: cache only as long as the origin says`,
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.minutes(5),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `${props.name} POC`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // Order matters: the specific path must come before /api/*.
      additionalBehaviors: {
        '/api/products': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: originCacheHeaders,
        },
        '/api/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });
    new s3deploy.BucketDeployment(this, 'WebFiles', {
      sources: [s3deploy.Source.asset(props.webDir)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Observability: alarms only (no notification target for the demo).
    const errors5xx = new cloudwatch.MathExpression({
      label: 'ALB + target 5xx',
      expression: 'FILL(elb, 0) + FILL(target, 0)',
      usingMetrics: {
        elb: api.loadBalancer.metrics.httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT),
        target: api.targetGroup.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT),
      },
      period: Duration.minutes(1),
    });
    errors5xx.createAlarm(this, 'Api5xxAlarm', {
      alarmDescription: `${props.name}: 5xx responses from the API`,
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    api.targetGroup.metrics
      .unhealthyHostCount({ period: Duration.minutes(1), statistic: 'Maximum' })
      .createAlarm(this, 'UnhealthyHostsAlarm', {
        alarmDescription: `${props.name}: API tasks failing health checks`,
        threshold: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

    // Outputs for the demo run-sheet.
    new CfnOutput(this, 'Url', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'AlbDnsName', { value: api.loadBalancer.loadBalancerDnsName });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'ServiceName', { value: api.service.serviceName });
    new CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
  }
}
