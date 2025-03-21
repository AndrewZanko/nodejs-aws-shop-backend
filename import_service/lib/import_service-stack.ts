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

    bucket.grantReadWrite(importProductsFileLambda);
    bucket.grantReadWrite(importFileParserLambda);
    catalogItemsQueue.grantSendMessages(importFileParserLambda);

    const api = new apigateway.RestApi(this, "ImportApi", {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "OPTIONS"],
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
