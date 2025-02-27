import { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../getProductsById";

describe("getProductsById lambda", () => {
  it("should return product when valid id is provided", async () => {
    const event = {
      pathParameters: { productId: "1" },
    } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body).toHaveProperty("id", 1);
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("description");
    expect(body).toHaveProperty("price");
  });

  it("should return 404 when product is not found", async () => {
    const invalidId = "invalid-id";
    const event = {
      pathParameters: { productId: invalidId },
    } as Partial<APIGatewayProxyEvent> as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty(
      "error",
      `Product with id ${invalidId} not found!`
    );
  });

  it("should return 400 when id isn't provided", async () => {
    const event = {
      pathParameters: null,
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({ error: "Product id is required!" });
  });
});
