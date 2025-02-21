import { APIGatewayProxyHandler } from "aws-lambda";
import { mockProducts } from "./mocks";
import { commonHeaders } from "./headers";

export const handler: APIGatewayProxyHandler = async (event) => {
  const productId = event.pathParameters?.productId;

  if (!productId) {
    // Technically this case is impossible - it will be handled by getProductsList lambda
    return {
      statusCode: 400,
      headers: commonHeaders,
      body: JSON.stringify({ error: "Product id is required!" }),
    };
  }

  const selectedProduct = mockProducts.find(
    (item) => item.id === Number(productId)
  );

  if (!selectedProduct) {
    return {
      statusCode: 404,
      headers: commonHeaders,
      body: JSON.stringify({
        error: `Product with id ${productId} not found!`,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: commonHeaders,
    body: JSON.stringify(selectedProduct),
  };
};
