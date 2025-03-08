import { S3Event, S3Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv = require("csv-parser");

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const UPLOAD_FOLDER = "uploaded/";

export const handler: S3Handler = async (event: S3Event) => {
  console.log("Received event:", event);

  for (const record of event.Records) {
    const key = record.s3.object.key;
    console.log(`Processing file: ${key}`);

    if (!key.startsWith(UPLOAD_FOLDER)) {
      console.log(`Skipping file outside ${UPLOAD_FOLDER}: ${key}`);
      continue;
    }

    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const { Body } = await s3.send(getObjectCommand);

      if (!Body || !(Body instanceof Readable)) {
        console.error(`Failed to retrieve readable stream for file: ${key}`);
        continue;
      }

      await new Promise<void>((resolve, reject) => {
        Body.pipe(
          csv({
            separator: ";", // Specify semicolon as delimiter
            quote: '"', // Specify quote character
          })
        )
          .on("data", (row) => {
            console.log("Parsed record:", {
              title: row.title,
              description: row.description,
              price: Number(row.price),
              count: Number(row.count),
            });
          })
          .on("end", () => {
            console.log(`Finished processing file: ${key}`);
            resolve();
          })
          .on("error", (error) => {
            console.error(`Error parsing CSV file: ${key}`, error);
            reject(error);
          });
      });
    } catch (error) {
      console.error(`Error processing file ${key}:`, error);
    }
  }
};
