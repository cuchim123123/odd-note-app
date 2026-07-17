import { Injectable, Logger, Inject } from '@nestjs/common';
import type { EnvConfig } from '@config/env.validation';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { uuidv7 } from 'uuidv7';

import type { IStoragePort } from '@modules/uploads/application/ports/storage.port';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class S3StorageAdapter implements IStoragePort {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;

  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {
    const useSsl = this.env.S3_USE_SSL;
    const protocol = useSsl ? 'https' : 'http';

    const s3Host = this.env.S3_ENDPOINT;
    const s3Port = this.env.S3_PORT;

    this.endpoint = s3Host.startsWith('http://') || s3Host.startsWith('https://') 
      ? `${s3Host}:${s3Port}` 
      : `${protocol}://${s3Host}:${s3Port}`;

    this.publicEndpoint = this.env.S3_PUBLIC_ENDPOINT || this.endpoint;

    const region = 'us-east-1'; // MinIO default
    const accessKey = this.env.S3_ACCESS_KEY;
    const secretKey = this.env.S3_SECRET_KEY;
    this.bucket = this.env.S3_BUCKET;

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
      await this.setBucketPolicy();
    } catch (err) {
      this.logger.log(`Bucket '${this.bucket}' not found or MinIO not ready; attempting to create...`);
      this.logger.debug(`HeadBucket error: ${getErrorMessage(err)}`);
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket '${this.bucket}' created`);
        await this.setBucketPolicy();
      } catch (createErr) {
        this.logger.error(
          `Failed to create bucket '${this.bucket}'. MinIO might not be fully initialized yet. Error: ${getErrorMessage(createErr)}`,
        );
        // Don't throw the error, allow the app to start. MinIO uploads might fail until it's ready.
      }
    }
  }

  private async setBucketPolicy(): Promise<void> {
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };

      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify(policy),
        }),
      );
      this.logger.log(`Public read policy set on bucket '${this.bucket}'`);
    } catch (policyErr) {
      this.logger.error(
        `Failed to set public policy on bucket '${this.bucket}': ${getErrorMessage(policyErr)}`,
      );
    }
  }

  async uploadBuffer(buffer: Buffer, filename: string, contentType?: string) {
    const key = `${Date.now()}-${uuidv7()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `${this.publicEndpoint}/${this.bucket}/${encodeURIComponent(key)}`;

    // generate a presigned GET URL valid for 1 hour
    const rawSignedUrl = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
    const signedUrl = rawSignedUrl.replace(this.endpoint, this.publicEndpoint);

    return { url, key, signedUrl };
  }
}
