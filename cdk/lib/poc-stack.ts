import * as path from 'path';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ThreeTierWorkload } from './three-tier-workload';

export interface PocStackProps extends StackProps {
  readonly appVersion: string;
}

/** StoreOps: the first app off the VM platform. */
export class PocStack extends Stack {
  constructor(scope: Construct, id: string, props: PocStackProps) {
    super(scope, id, props);

    new ThreeTierWorkload(this, 'StoreOps', {
      name: 'StoreOps',
      apiImageDir: path.join(__dirname, '../../app/api'),
      webDir: path.join(__dirname, '../../app/web'),
      apiCpu: 256,
      apiMemory: 512,
      minTasks: 2,
      maxTasks: 10,
      appVersion: props.appVersion,
    });
  }
}
