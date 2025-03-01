import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { commonHeaders } from "./headers";

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Received event:", event);

    let body;

    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch (error) {
      console.error("Error while parsing request body: ", error);
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({
          message: "Invalid JSON in request body.",
        }),
      };
    }

    if (
      !body ||
      typeof body.title !== "string" ||
      typeof body.price !== "number" ||
      typeof body.count !== "number" ||
      (typeof body.description !== "string" &&
        typeof body.description !== "undefined" &&
        body.description !== null) ||
      body.count < 0 ||
      body.price <= 0
    ) {
      return {
        statusCode: 400,
        headers: commonHeaders,
        body: JSON.stringify({
          message: "Invalid parameters values.",
        }),
      };
    }

    const productId = randomUUID();
    const { title, price, description = "", count } = body;

    const productParams = new PutCommand({
      TableName: PRODUCTS_TABLE,
      Item: { id: productId, title, description, price },
    });

    console.log("Storing product:", productParams);
    await dynamoDb.send(productParams);

    const stockParams = new PutCommand({
      TableName: STOCKS_TABLE,
      Item: { product_id: productId, count },
    });

    console.log("Storing stock:", stockParams);
    await dynamoDb.send(stockParams);

    const createdProduct = { id: productId, title, description, price, count };
    return {
      statusCode: 201,
      headers: commonHeaders,
      body: JSON.stringify(createdProduct),
    };
  } catch (error) {
    console.error("Error creating product:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
