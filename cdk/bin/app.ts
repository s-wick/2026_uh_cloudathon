#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib';
import { PocStack } from '../lib/poc-stack';

const app = new App();

// Rolling-deploy demo: npx cdk deploy -c appVersion=v2
const appVersion: string = app.node.tryGetContext('appVersion') ?? 'v1';

const stack = new PocStack(app, 'StoreOpsPoc', {
  env: { account: '811428812009', region: 'us-west-2' },
  description: 'AnyCompany StoreOps POC: migrated off the VM platform',
  appVersion,
});
Tags.of(stack).add('Project', 'StoreOps-POC');
