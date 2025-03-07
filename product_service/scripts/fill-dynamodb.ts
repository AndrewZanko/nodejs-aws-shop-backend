import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = new DynamoDBClient({ region: "eu-west-1" });
const docClient = DynamoDBDocumentClient.from(client);

const productsTable = process.env.PRODUCTS_TABLE || "products";
const stocksTable = process.env.STOCKS_TABLE || "stocks";

// Mock products data
const products = [
  {
    id: randomUUID(),
    title: "Aurora",
    description: "Elegance and luxury",
    price: 690,
  },
  {
    id: randomUUID(),
    title: "Borealis",
    description: "Brutal and stylish",
    price: 380,
  },
  {
    id: randomUUID(),
    title: "Chorus",
    description: "Mysterious and eye-catching",
    price: 420,
  },
  {
    id: randomUUID(),
    title: "Delor",
    description: "Innovative and game-changer",
    price: 500,
  },
];

// Mock stocks data (each stock references a product's `id`)
const stocks = products.map((product) => ({
  product_id: product.id,
  count: Math.floor(Math.random() * 100) + 1,
}));

async function clearTable(tableName: string, keyName: string) {
  console.log(`Clearing table: ${tableName}...`);

  try {
    // Scan for all items
    const scanCommand = new ScanCommand({ TableName: tableName });
    const { Items } = await client.send(scanCommand);

    if (!Items || Items.length === 0) {
      console.log(`Table ${tableName} is already empty.`);
      return;
    }

    // Delete each item
    for (const item of Items) {
      const key = { [keyName]: item[keyName] };
      await client.send(
        new DeleteItemCommand({ TableName: tableName, Key: key })
      );
      console.log(`Deleted item from ${tableName}: ${JSON.stringify(key)}`);
    }

    console.log(`Table ${tableName} cleared.`);
  } catch (error) {
    console.error(`Error clearing table ${tableName}:`, error);
  }
}

async function seedData() {
  console.log("Seeding DynamoDB tables...");

  try {
    // Clear tables before inserting new data
    await clearTable(productsTable, "id");
    await clearTable(stocksTable, "product_id");

    // Insert new products
    for (const product of products) {
      await docClient.send(
        new PutCommand({ TableName: productsTable, Item: product })
      );
      console.log(`Inserted product: ${product.id} - ${product.title}`);
    }

    // Insert new stocks
    for (const stock of stocks) {
      await docClient.send(
        new PutCommand({ TableName: stocksTable, Item: stock })
      );
      console.log(`Inserted stock: ${stock.product_id} - ${stock.count}`);
    }

    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding data:", error);
  }
}

seedData();
