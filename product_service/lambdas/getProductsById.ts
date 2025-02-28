import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, GetCommandInput } from "@aws-sdk/lib-dynamodb";
import { commonHeaders } from "./headers";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const productId = event.pathParameters?.productId;

  if (!productId) {
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
      Key: { id: productId },  // id is a string
    };

    const productResult = await docClient.send(new GetCommand(productParams));

    // Log the result of the product query
    console.log("Product result:", productResult);

    if (!productResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    console.log(`Fetching stock for product ${productId} from ${STOCKS_TABLE}`);

    const stockParams: GetCommandInput = {
      TableName: STOCKS_TABLE,
      Key: { product_id: productId },
    };

    const stockResult = await docClient.send(new GetCommand(stockParams));

    const product = {
      ...productResult.Item,
      count: stockResult.Item?.count ?? 0,  // Default to 0 if stock data is missing
    };

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
