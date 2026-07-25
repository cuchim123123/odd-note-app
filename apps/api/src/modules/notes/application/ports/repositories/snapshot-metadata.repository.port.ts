import type { NoteSnapshotMetadata } from '@modules/notes/domain/entities/note-snapshot-metadata.entity';

export const SNAPSHOT_METADATA_REPOSITORY = Symbol('SNAPSHOT_METADATA_REPOSITORY');

export interface ISnapshotMetadataRepository {
  /**
   * Saves a new snapshot metadata record pointing to S3.
   */
  save(metadata: NoteSnapshotMetadata): Promise<void>;

  /**
   * Finds the latest snapshot metadata for a note that is <= targetSeq.
   */
  findNearestBefore(noteId: string, targetSeq: bigint): Promise<NoteSnapshotMetadata | null>;

  /**
   * Finds the most recent snapshot for a note with no upper bound.
   * Use this instead of passing BigInt(MAX_SAFE_INTEGER) as a ceiling.
   */
  findLatest(noteId: string): Promise<NoteSnapshotMetadata | null>;
}
