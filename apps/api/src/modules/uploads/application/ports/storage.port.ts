export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface UploadResult {
  url: string;
  key: string;
  signedUrl: string; // The presigned URL for GET
}

export interface PresignedUploadResult {
  uploadUrl: string; // The presigned URL for PUT
  url: string; // The final public URL
  key: string;
}

export interface IStoragePort {
  ensureBucketExists(): Promise<void>;
  uploadBuffer(buffer: Buffer, filename: string, contentType?: string): Promise<UploadResult>;
  generatePresignedUploadUrl(filename: string, contentType: string, size?: number): Promise<PresignedUploadResult>;
}
