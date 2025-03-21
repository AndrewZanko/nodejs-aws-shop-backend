import {
  APIGatewayAuthorizerResult,
  APIGatewayProxyResult,
  APIGatewayTokenAuthorizerEvent,
  StatementEffect,
} from "aws-lambda";

const generatePolicy = (
  principalId: string,
  effect: StatementEffect,
  resource: string
): APIGatewayAuthorizerResult => ({
  principalId,
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: resource,
      },
    ],
  },
});

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayProxyResult | APIGatewayAuthorizerResult> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  if (!event.authorizationToken) {
    return generatePolicy("user", "Deny", event.methodArn);
  }

  try {
    const token = event.authorizationToken.split(" ")[1]; // Get base64 token after "Basic "
    const decodedCredentials = Buffer.from(token, "base64").toString("utf-8");
    const [login, password] = decodedCredentials.split(":");

    if (process.env[login] && process.env[login] === password) {
      console.log("User authorized");

      return generatePolicy("user", "Allow", event.methodArn);
    } else {
      console.log("User not authorized");
      return generatePolicy("user", "Deny", event.methodArn);
    }
  } catch (error) {
    console.error("Authorization error:", error);

    return generatePolicy("user", "Deny", event.methodArn);
  }
};
