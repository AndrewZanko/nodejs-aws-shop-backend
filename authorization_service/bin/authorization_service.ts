#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AuthorizationServiceStack } from '../lib/authorization_service-stack';

const app = new cdk.App();
new AuthorizationServiceStack(app, 'AuthorizationServiceStack', {
  env: { region: "eu-west-1" },
});