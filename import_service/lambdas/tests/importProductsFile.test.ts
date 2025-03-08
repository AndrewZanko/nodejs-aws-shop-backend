import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockClient } from "aws-sdk-client-mock";
import { APIGatewayProxyEvent } from "aws-lambda"; // ✅ Import correct event type
import { handler } from "../importProductsFile";

// Mock S3 client
const s3Mock = mockClient(S3Client);

// Mock getSignedUrl function
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

describe("importProductsFile Lambda", () => {
  beforeEach(() => {
    s3Mock.reset(); // Reset mocks before each test
    process.env.BUCKET_NAME = "test-bucket"; // Set environment variable
  });

  const createEvent = (name?: string): APIGatewayProxyEvent => ({
    queryStringParameters: name ? { name } : null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/import",
    pathParameters: null,
    requestContext: {} as any,
    resource: "",
    stageVariables: null,
    multiValueQueryStringParameters: null,
  });

  it("should return a signed URL when name is provided", async () => {
    const mockSignedUrl = "https://test-bucket.s3.amazonaws.com/uploaded/test.csv?signature=mocked";

    (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

    const event = createEvent("test.csv");

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(mockSignedUrl);

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.any(PutObjectCommand),
      { expiresIn: 300 }
    );
  });

  it("should return 400 error if fileName is missing", async () => {
    const event = createEvent();

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: "File name is required",
    });
  });

  it("should return 500 error if an exception occurs", async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error("S3 error")); // ✅ Mock error case

    const event = createEvent("test.csv");

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ message: "Error generating signed URL" });

    expect(getSignedUrl).toHaveBeenCalled();
  });
});
