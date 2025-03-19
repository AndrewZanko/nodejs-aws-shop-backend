import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { handler } from "../catalogBatchProcess"; // Import Lambda
import { SQSEvent } from "aws-lambda";

// Mock AWS Clients
const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

const PRODUCTS_TABLE = "mockProductsTable";
const STOCKS_TABLE = "mockStocksTable";

// Environment Variables
process.env.PRODUCTS_TABLE = PRODUCTS_TABLE;
process.env.STOCKS_TABLE = STOCKS_TABLE;

const mockValidProduct: SQSEvent["Records"][number] = {
  body: JSON.stringify({
    id: "p1",
    title: "Test Product",
    description: "A test product",
    price: 99,
    count: 10,
  }),
  messageId: "1",
  receiptHandle: "test-receipt",
  attributes: {
    ApproximateReceiveCount: "1",
    SentTimestamp: "1234567890",
    SenderId: "TESTID",
    ApproximateFirstReceiveTimestamp: "1234567890",
  },
  messageAttributes: {
    count: { dataType: "Number", stringValue: "10" },
  },
  md5OfBody: "test-md5",
  eventSource: "aws:sqs",
  eventSourceARN: "test:arn",
  awsRegion: "eu-west-1",
};

const mockInvalidProduct: SQSEvent["Records"][number] = {
  ...mockValidProduct,
  body: JSON.stringify({
    id: "",
    title: "Invalid Product",
    price: -10,
    count: 5,
  }),
  messageId: "2",
};

describe("catalogBatchProcess", () => {
  beforeEach(() => {
    ddbMock.reset();
    snsMock.reset();
  });

  it("Processes valid products and performs DynamoDB transaction", async () => {
    // Mock successful transaction write
    ddbMock.on(TransactWriteCommand).resolves({});

    // Mock SNS publish
    snsMock.on(PublishCommand).resolves({ MessageId: "1234" });

    // Sample SQS event
    const event: SQSEvent = {
      Records: [mockValidProduct],
    };

    // Call Lambda
    await handler(event);

    // Ensure DynamoDB transaction was called
    expect(ddbMock.calls()).toHaveLength(1);

    console.log("SNS Calls:", snsMock.calls());
    console.log("SNS Command Calls:", snsMock.commandCalls(PublishCommand));
    console.log(
      "First SNS Call Args:",
      JSON.stringify(snsMock.commandCalls(PublishCommand)[0]?.args, null, 2)
    );
    expect(
      ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems
    ).toHaveLength(2);

    // Ensure SNS notification was sent
    expect(snsMock.calls()).toHaveLength(1);
  });

  it("Skips invalid products and does not save to DynamoDB", async () => {
    const event: SQSEvent = {
      Records: [mockValidProduct, mockInvalidProduct],
    };

    ddbMock.on(TransactWriteCommand).resolves({});
    snsMock.on(PublishCommand).resolves({});

    await handler(event);

    // Only the valid product should be processed
    expect(ddbMock.calls()).toHaveLength(1);
    expect(snsMock.calls()).toHaveLength(1);
  });

  it("Handles DynamoDB transaction errors gracefully", async () => {
    ddbMock
      .on(TransactWriteCommand)
      .rejects(new Error("DynamoDB transaction failed"));

    const event: SQSEvent = {
      Records: [mockValidProduct],
    };

    await expect(handler(event)).resolves.not.toThrow();

    // Ensure DB was called, but SNS was not triggered
    expect(ddbMock.calls()).toHaveLength(1);
    expect(snsMock.calls()).toHaveLength(0);
  });

  it("Handles SNS errors gracefully", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    snsMock.on(PublishCommand).rejects(new Error("SNS error"));

    const event: SQSEvent = {
      Records: [mockValidProduct],
    };

    await expect(handler(event)).resolves.not.toThrow();

    // Ensure product was saved but SNS failed
    expect(ddbMock.calls()).toHaveLength(1);
    expect(snsMock.calls()).toHaveLength(1);
  });
});
