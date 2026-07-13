export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface UploadResult {
  url: string;
  key: string;
  signedUrl: string;
}

export interface IStoragePort {
  ensureBucketExists(): Promise<void>;
  uploadBuffer(buffer: Buffer, filename: string, contentType?: string): Promise<UploadResult>;
}
