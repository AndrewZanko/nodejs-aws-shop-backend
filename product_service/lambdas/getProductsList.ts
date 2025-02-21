import { APIGatewayProxyHandler } from "aws-lambda";
import { mockProducts } from "./mocks";
import { commonHeaders } from "./headers";

export const handler: APIGatewayProxyHandler = async (event) => {
  return {
    statusCode: 200,
    headers: commonHeaders,
    body: JSON.stringify(mockProducts),
  };
};
