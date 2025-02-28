import { handler } from './../cdk.out/asset.46296547109a87a71e1567136db3ba6875d1ef83a25f4c7734db5ff95ec234e2/getProductsList';
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableName(this, "ProductsTable", "products");
    const stocksTable = dynamodb.Table.fromTableName(this, "StocksTable", "stocks");

    const lambdaProps: Omit<cdk.aws_lambda.FunctionProps, 'handler'> = {
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

    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products service",
    });

    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);
    productsTable.grantReadData(getProductsById);
    stocksTable.grantReadData(getProductsById);

    const products = api.root.addResource("products");
    const productId = products.addResource("{productId}");

    const getProductsListIntegration = new apigateway.LambdaIntegration(
      getProductsList
    );
    products.addMethod("GET", getProductsListIntegration);

    const getProductIntegration = new apigateway.LambdaIntegration(
      getProductsById
    );
    productId.addMethod("GET", getProductIntegration);
  }
}
