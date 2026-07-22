import { NoteId } from '@shared/domain/ddd/id-types';

/**
 * NoteSnapshotMetadata — pointer to a pre-computed Y.Doc snapshot stored in S3.
 * Purely a read optimization.
 */
export class NoteSnapshotMetadata {
  private readonly _id: string;
  private readonly _noteId: NoteId;
  private readonly _snapshotSeq: bigint;

  constructor(
    id: string,
    noteId: NoteId,
    snapshotSeq: bigint,
    public readonly s3ObjectKey: string,
    public readonly createdAt: Date,
  ) {
    this._id = id;
    this._noteId = noteId;
    this._snapshotSeq = snapshotSeq;
  }

  get id(): string { return this._id; }
  get noteId(): string { return this._noteId; }
  get snapshotSeq(): bigint { return this._snapshotSeq; }

  static create(params: {
    id: string;
    noteId: string;
    snapshotSeq: bigint;
    s3ObjectKey: string;
    createdAt: Date;
  }): NoteSnapshotMetadata {
    return new NoteSnapshotMetadata(
      params.id,
      NoteId.from(params.noteId),
      params.snapshotSeq,
      params.s3ObjectKey,
      params.createdAt,
    );
  }
}
