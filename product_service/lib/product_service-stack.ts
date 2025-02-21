import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const getProductsList = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambdas")),
      handler: "getProductsList.handler",
    });

    const getProductsById = new lambda.Function(this, "getProductsById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambdas")),
      handler: "getProductsById.handler",
    });

    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Products service",
    });

    const products = api.root.addResource("products");
    const productId = products.addResource("{productId}");

    const getProductsListIntegration = new apigateway.LambdaIntegration(
      getProductsList
    );
    products.addMethod("GET", getProductsListIntegration);

    const getProductIntegration = new apigateway.LambdaIntegration(
      getProductsById,
    );
    productId.addMethod("GET", getProductIntegration);
  }
}
