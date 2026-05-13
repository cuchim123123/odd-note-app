import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor() {
    const useSsl = (process.env.S3_USE_SSL || 'false').toLowerCase() === 'true';
    const protocol = useSsl ? 'https' : 'http';

    const s3Host = process.env.S3_ENDPOINT;
    const s3Port = process.env.S3_PORT;

    this.endpoint = s3Host
      ? `${s3Host.startsWith('http://') || s3Host.startsWith('https://') ? s3Host : `${protocol}://${s3Host}`}${s3Port ? `:${s3Port}` : ''}`
      : process.env.MINIO_ENDPOINT || 'http://minio:9000';

    const region = process.env.MINIO_REGION || 'us-east-1';
    const accessKey = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || 'minioadmin';
    this.bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'oddnote-uploads';

    this.client = new S3Client({
      endpoint: this.endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
  }

  async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket '${this.bucket}' already exists`);
    } catch (err) {
      this.logger.log(`Bucket '${this.bucket}' not found; creating`);
      this.logger.debug(String(err));
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket '${this.bucket}' created`);
    }
  }

  async uploadBuffer(buffer: Buffer, filename: string, contentType?: string) {
    const key = `${Date.now()}-${randomUUID()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `${this.endpoint}/${this.bucket}/${encodeURIComponent(key)}`;

    // generate a presigned GET URL valid for 1 hour
    const signedUrl = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });

    return { url, key, signedUrl };
  }
}
