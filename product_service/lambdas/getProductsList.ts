import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { mockProducts } from "./mocks";
import { commonHeaders } from "./headers";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: commonHeaders,
    body: JSON.stringify(mockProducts),
  };
};
