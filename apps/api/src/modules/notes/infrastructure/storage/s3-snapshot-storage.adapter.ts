import { Injectable, Logger } from '@nestjs/common';
import type { ISnapshotStoragePort } from '@modules/notes/application/ports/services/snapshot-storage.port';

@Injectable()
export class S3SnapshotStorageAdapter implements ISnapshotStoragePort {
  private readonly logger = new Logger(S3SnapshotStorageAdapter.name);

  // In a real app, inject AWS S3 client / MinIO client here.
  // constructor(private readonly s3Client: S3Client) {}

  async uploadSnapshot(noteId: string, seq: bigint, snapshotBlob: Uint8Array): Promise<string> {
    const objectKey = `snapshots/${noteId}/${seq.toString()}.bin`;
    
    this.logger.debug(`Uploading snapshot to S3: ${objectKey} (${snapshotBlob.byteLength} bytes)`);
    
    // Fake S3 upload delay
    // await this.s3Client.putObject({ Bucket: 'odd-note-snapshots', Key: objectKey, Body: Buffer.from(snapshotBlob) });

    return objectKey;
  }

  async downloadSnapshot(s3ObjectKey: string): Promise<Uint8Array> {
    this.logger.debug(`Downloading snapshot from S3: ${s3ObjectKey}`);
    
    // Fake S3 download delay
    // const response = await this.s3Client.getObject({ Bucket: 'odd-note-snapshots', Key: s3ObjectKey });
    // return new Uint8Array(await response.Body.transformToByteArray());

    return new Uint8Array(); // Dummy return for now
  }
}
