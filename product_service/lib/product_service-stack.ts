import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
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

    const getProductsList = new lambda.Function(this, "getProductsList", {
      handler: "getProductsList.handler",
      ...lambdaProps,
    });

    const getProductsById = new lambda.Function(this, "getProductsById", {
      handler: "getProductsById.handler",
      ...lambdaProps,
    });

    const createProduct = new lambda.Function(this, "createProduct", {
      handler: "createProduct.handler",
      ...lambdaProps,
    });

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

    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);
    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);
    productsTable.grantWriteData(createProduct);
    stocksTable.grantWriteData(createProduct);

    const products = api.root.addResource("products");
    const productId = products.addResource("{productId}");

    const getProductsListIntegration = new apigateway.LambdaIntegration(
      getProductsList
    );
    products.addMethod("GET", getProductsListIntegration);
    products.addMethod("POST", new apigateway.LambdaIntegration(createProduct));

    const getProductIntegration = new apigateway.LambdaIntegration(
      getProductsById
    );
    productId.addMethod("GET", getProductIntegration);
  }
}
