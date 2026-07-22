export const SNAPSHOT_STORAGE_PORT = Symbol('SNAPSHOT_STORAGE_PORT');

export interface ISnapshotStoragePort {
  /**
   * Uploads a binary Y.Doc snapshot to Object Storage and returns the object key.
   */
  uploadSnapshot(noteId: string, seq: bigint, snapshotBlob: Uint8Array): Promise<string>;

  /**
   * Downloads a binary Y.Doc snapshot from Object Storage using its object key.
   */
  downloadSnapshot(s3ObjectKey: string): Promise<Uint8Array>;
}
