import { S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import csv = require("csv-parser");
import { randomUUID } from "crypto";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const UPLOAD_FOLDER = "uploaded/";
const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.CATALOG_ITEMS_QUEUE_URL!;

export const handler = async (event: S3Event): Promise<any> => {
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

      const { Body } = await s3Client.send(getObjectCommand);

      if (!Body || !(Body instanceof Readable)) {
        console.error(`Failed to retrieve readable stream for file: ${key}`);
        continue;
      }

      let rowsBatch: any[] = [];

      await new Promise<void>((resolve, reject) => {
        Body.pipe(csv())
          .on("data", async (row: Record<string, any>) => {
            const productId = randomUUID();
            rowsBatch.push({
              id: productId,
              ...row,
              price: Number(row.price),
              count: Number(row.count),
            });

            if (rowsBatch.length === 5) {
              await sendBatchToSQS(rowsBatch);
              rowsBatch = [];
            }
          })
          .on("end", async () => {
            if (rowsBatch.length > 0) {
              await sendBatchToSQS(rowsBatch);
            }
            console.log(`Finished processing file: ${key}`);
            const newKey = key.replace("uploaded/", "parsed/");
            await moveFile(BUCKET_NAME, key, newKey);
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

const sendBatchToSQS = async (records: any[]) => {
  try {
    const entries = records.map((record, index) => ({
      Id: index.toString(),
      MessageBody: JSON.stringify(record),
    }));

    await sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: QUEUE_URL,
        Entries: entries,
      })
    );
  } catch (error) {
    console.error("Error sending messages to SQS:", error);
  }
};

const moveFile = async (
  bucket: string,
  sourceKey: string,
  targetKey: string
) => {
  try {
    console.log(
      `Moving file from ${sourceKey} to ${targetKey} in bucket ${bucket}`
    );
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: encodeURIComponent(`${bucket}/${sourceKey}`),
        Key: targetKey,
      })
    );
    console.log(`File added to: ${targetKey}`);

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: sourceKey,
      })
    );
    console.log(`File removed from: ${sourceKey}`);
  } catch (error) {
    console.error("Error moving file, error:", error);
  }
};
