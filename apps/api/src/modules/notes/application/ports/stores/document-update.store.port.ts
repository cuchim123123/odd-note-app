export const DOCUMENT_UPDATE_STORE = Symbol('DOCUMENT_UPDATE_STORE');

export interface AppendDocumentUpdateDto {
  noteId: string;
  updateBlob: Uint8Array;
  sizeBytes: number;
  authorId: string;
  createdAt: Date;
}

export interface StoredDocumentUpdate {
  seq: bigint;
  noteId: string;
  updateBlob: Uint8Array;
  sizeBytes: number;
  authorId: string;
  createdAt: Date;
}

export interface IDocumentUpdateStore {
  /**
   * Appends a new update to the log and returns the stored document update.
   * This provides the atomic `RETURNING seq` guarantee.
   */
  append(update: AppendDocumentUpdateDto): Promise<StoredDocumentUpdate>;

  /**
   * Fetches a range of updates for a document.
   * Useful for rebuilding state from a snapshot to a target sequence.
   */
  getUpdatesInRange(noteId: string, fromSeqExclusive: bigint, toSeqInclusive: bigint): Promise<StoredDocumentUpdate[]>;

  /**
   * Fetches updates since a specific sequence.
   */
  getUpdatesSince(noteId: string, fromSeqExclusive: bigint): Promise<StoredDocumentUpdate[]>;
}
