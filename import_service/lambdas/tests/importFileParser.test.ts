import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { handler } from '../importFileParser';
import { S3Event } from 'aws-lambda';

jest.mock('@aws-sdk/client-s3');

const mockSend = jest.fn();
S3Client.prototype.send = mockSend;

describe('handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process CSV file, copy it to parsed folder, and delete the original', async () => {
    const csvData = 'id;title;description;price;count\nid1;Product1;Description1;10;5';
    const s3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test.csv' }
          }
        }
      ]
    } as S3Event;

    const mockS3Stream = Readable.from([csvData]);
    mockSend.mockImplementation((command) => {
      if (command instanceof GetObjectCommand) {
        return { Body: mockS3Stream };
      }
      return {};
    });

    await handler(s3Event);

    expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    expect(mockSend).toHaveBeenCalledWith(expect.any(CopyObjectCommand));
    expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
  });

  it('should log an error if an exception occurs', async () => {
    console.error = jest.fn();

    mockSend.mockRejectedValue(new Error('S3 error'));
    const s3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test.csv' }
          }
        }
      ]
    } as S3Event;

    await handler(s3Event);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error processing file'), expect.any(Error));
  });
});