import { handler } from "../getProductsList";
import { APIGatewayProxyEvent } from "aws-lambda";

const mockEvent: APIGatewayProxyEvent = {} as any;

describe("getProductsList lambda", () => {
  test("should return all products", async () => {
    const response = await handler(mockEvent);

    expect(response).toBeDefined();
    expect(response.statusCode).toBe(200);

    const products = JSON.parse(response.body);
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBe(3);
  });
});