import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as path from "path";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableName(
      this,
      "ProductsTable",
      "products"
    );
    const stocksTable = dynamodb.Table.fromTableName(
      this,
      "StocksTable",
      "stocks"
    );

    const createProductTopic = new sns.Topic(this, "CreateProductTopic");

    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('a.zanko@softteco.com', {
        filterPolicy: {
          count: sns.SubscriptionFilter.numericFilter({
            greaterThan: 40,
          }),
        },
      })
    );
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('sem.andrej9@gmail.com', {
        filterPolicy: {
          count: sns.SubscriptionFilter.numericFilter({
            lessThanOrEqualTo: 40,
          }),
        },
      })
    );

    const catalogItemsQueue = new sqs.Queue(this, "CatalogItemsQueue", {
      queueName: "catalogItemsQueue",
      visibilityTimeout: cdk.Duration.seconds(30), // Ensure enough time for Lambda to process
    });

    const lambdaProps: Omit<cdk.aws_lambda.FunctionProps, "handler"> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambdas")),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    };

    const getProductsListLambda = new lambda.Function(this, "getProductsList", {
      handler: "getProductsList.handler",
      ...lambdaProps,
    });

    const getProductsByIdLambda = new lambda.Function(this, "getProductsById", {
      handler: "getProductsById.handler",
      ...lambdaProps,
    });

    const createProductLambda = new lambda.Function(this, "createProduct", {
      handler: "createProduct.handler",
      ...lambdaProps,
    });

    const catalogBatchProcessLambda = new lambda.Function(
      this,
      "importProduct",
      {
        handler: "catalogBatchProcess.handler",
        ...lambdaProps,
        environment: {
          ...lambdaProps.environment,
          SNS_TOPIC_ARN: createProductTopic.topicArn,
        },
      }
    );

    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
        ],
      },
    });

    productsTable.grantReadData(getProductsListLambda);
    stocksTable.grantReadData(getProductsListLambda);
    productsTable.grantReadData(getProductsByIdLambda);
    stocksTable.grantReadData(getProductsByIdLambda);
    productsTable.grantWriteData(createProductLambda);
    stocksTable.grantWriteData(createProductLambda);
    productsTable.grantWriteData(catalogBatchProcessLambda);
    stocksTable.grantWriteData(catalogBatchProcessLambda);

    const products = api.root.addResource("products");
    const productId = products.addResource("{productId}");

    const getProductsListIntegration = new apigateway.LambdaIntegration(
      getProductsListLambda
    );
    products.addMethod("GET", getProductsListIntegration);
    products.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createProductLambda)
    );

    const getProductIntegration = new apigateway.LambdaIntegration(
      getProductsByIdLambda
    );
    productId.addMethod("GET", getProductIntegration);

    catalogBatchProcessLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      })
    );

    catalogItemsQueue.grantConsumeMessages(catalogBatchProcessLambda);
    createProductTopic.grantPublish(catalogBatchProcessLambda);

    // Export SQS queue ARN for the Import Service
    new cdk.CfnOutput(this, "CatalogItemsQueueArn", {
      value: catalogItemsQueue.queueArn,
      exportName: "CatalogItemsQueueArn",
    });
  }
}
