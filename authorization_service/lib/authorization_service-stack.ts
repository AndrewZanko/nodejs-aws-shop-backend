import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthorizerLambda = new lambda.Function(
      this,
      "BasicAuthorizerLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "basicAuthorizer.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambdas")),
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
      }
    );

    // Grant API Gateway permission to invoke the Lambda Authorizer
    basicAuthorizerLambda.addPermission("ApiGatewayInvokePermission", {
      action: "lambda:InvokeFunction",
      principal: new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:*/*/*`,
    });

    // Export Lambda ARN
    new cdk.CfnOutput(this, "BasicAuthorizerArn", {
      value: basicAuthorizerLambda.functionArn,
      exportName: "BasicAuthorizerLambdaArn",
    });
  }
}
