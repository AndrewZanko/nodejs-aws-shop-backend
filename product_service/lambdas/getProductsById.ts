import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { commonHeaders } from "./headers";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Received event:", event);
  const productId = event.pathParameters?.productId;

  if (!productId) {
    console.log("ProductId is missing");
    // Technically this case is impossible - it will be handled by getProductsList lambda
    return {
      statusCode: 400,
      headers: commonHeaders,
      body: JSON.stringify({ error: "Product id is required!" }),
    };
  }

  try {
    const productParams: GetCommandInput = {
      TableName: PRODUCTS_TABLE,
      Key: { id: productId },
    };

    console.log(`Receiving product ${productId}`);
    const productResult = await docClient.send(new GetCommand(productParams));

    if (!productResult.Item) {
      console.log(`Product ${productId} not found`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    console.log("Product result: ", productResult.Item);

    const stockParams: GetCommandInput = {
      TableName: STOCKS_TABLE,
      Key: { product_id: productId },
    };

    console.log(
      `Receiving stock for product ${productId} from ${STOCKS_TABLE}`
    );
    const stockResult = await docClient.send(new GetCommand(stockParams));
    console.log("Stock result: ", stockResult.Item);

    const product = {
      ...productResult.Item,
      count: stockResult.Item?.count ?? 0, // Default to 0 if stock data is missing
    };

    console.log(`Returning counted product: ${product}`);

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(product),
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
