#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GitHubWebhookStack } from './lib/webhook';

const app = new cdk.App();
new GitHubWebhookStack(app, 'SelfHostedRunnerWebhook', {
  // ToDo
  env: { account: '123456789012', region: 'us-east-1' },
});