import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as path from "path";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = s3.Bucket.fromBucketName(
      this,
      "ExistingBucket",
      "beimportbucket"
    );

    // Get the existing SQS queue from the Products stack
    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      "CatalogItemsQueue",
      cdk.Fn.importValue("CatalogItemsQueueArn")
    );

    const lambdaProps: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
      bundling: {
        externalModules: [],
      },
    };

    const importProductsFileLambda = new NodejsFunction(
      this,
      "ImportProductsFileLambda",
      {
        entry: path.join(__dirname, "../lambdas/importProductsFile.ts"),
        ...lambdaProps,
      }
    );

    const importFileParserLambda = new NodejsFunction(
      this,
      "ImportFileParserLambda",
      {
        entry: path.join(__dirname, "../lambdas/importFileParser.ts"),
        ...lambdaProps,
      }
    );

    const basicAuthorizerLambdaArn = cdk.Fn.importValue(
      "BasicAuthorizerLambdaArn"
    );

    bucket.grantReadWrite(importProductsFileLambda);
    bucket.grantReadWrite(importFileParserLambda);
    catalogItemsQueue.grantSendMessages(importFileParserLambda);

    const importedAuthorizer = new apigateway.TokenAuthorizer(
      this,
      "ImportedAuthorizer",
      {
        handler: lambda.Function.fromFunctionArn(
          this,
          "BasicAuthorizerFunction",
          basicAuthorizerLambdaArn
        ),
        identitySource: apigateway.IdentitySource.header("Authorization"),
      }
    );

    const api = new apigateway.RestApi(this, "ImportApi", {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    const importResource = api.root.addResource("import");
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFileLambda),
      {
        requestParameters: {
          "method.request.querystring.name": true,
        },
        authorizer: importedAuthorizer, // Attach the Lambda authorizer
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
          {
            statusCode: "401",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
          {
            statusCode: "403",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
          {
            statusCode: "500",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
        ],
      }
    );

    importFileParserLambda.addEnvironment(
      "CATALOG_ITEMS_QUEUE_URL",
      catalogItemsQueue.queueUrl
    );

    importFileParserLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:CopyObject", "s3:DeleteObject"],
        resources: [`${bucket.bucketArn}/*`],
      })
    );

    // Add S3 event notification for files in the 'uploaded/' folder
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED, // Triggers on file creation
      new s3n.LambdaDestination(importFileParserLambda),
      { prefix: "uploaded/" } // Ensures only files in "uploaded/" trigger the event
    );
  }
}
