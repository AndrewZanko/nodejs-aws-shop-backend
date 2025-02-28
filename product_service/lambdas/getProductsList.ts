import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { commonHeaders } from "./headers";

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const [productsData, stocksData] = await Promise.all([
      docClient.send(new ScanCommand({ TableName: PRODUCTS_TABLE })).then((res) => {
        console.log(`Fetched ${res.Items?.length || 0} products`);
        return res.Items || [];
      }),
      docClient.send(new ScanCommand({ TableName: STOCKS_TABLE })).then((res) => {
        console.log(`Fetched ${res.Items?.length || 0} stock entries`);
        return res.Items || [];
      }),
    ]);

    const products = productsData.map((product) => {
      // Find the matching stock entry
      const stockEntry = stocksData.find((stock) => stock.product_id === product.id);
      return {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        count: stockEntry ? stockEntry.count : 0, // Default to 0 if no stock entry
      };
    });

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify(products),
    };
  } catch (error) {
    console.error("Error fetching products:", error);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
