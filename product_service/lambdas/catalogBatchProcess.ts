import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const product = JSON.parse(record.body);

      if (!isProductValid(product)) {
        console.warn("Invalid product:", product);
        continue;
      }

      const transactionParams = new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: PRODUCTS_TABLE,
              Item: {
                id: product.id,
                title: product.title,
                description: product.description || "",
                price: product.price,
              },
              ConditionExpression: "attribute_not_exists(id)",
            },
          },
          {
            Put: {
              TableName: STOCKS_TABLE,
              Item: { product_id: product.id, count: product.count },
              ConditionExpression: "attribute_not_exists(product_id)",
            },
          },
        ],
      });

      console.log(`Executing transaction`);
      await docClient.send(transactionParams);
      console.log("Transaction finished succesfully");
      console.log("New counted product: ", product);
    } catch (error) {
      console.error("Error processing SQS message: ", error);
    }
  }
};

const isProductValid = (product: Record<string, any>) => {
  return !(
    !product ||
    typeof product.id !== "string" ||
    typeof product.title !== "string" ||
    typeof product.price !== "number" ||
    typeof product.count !== "number" ||
    (typeof product.description !== "string" &&
      typeof product.description !== "undefined" &&
      product.description !== null) ||
    product.count < 0 ||
    product.price <= 0
  );
};
