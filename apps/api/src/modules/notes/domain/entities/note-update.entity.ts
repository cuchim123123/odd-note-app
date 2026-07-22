import { NoteId, UserId } from '@shared/domain/ddd/id-types';

/**
 * NoteUpdateLog — the absolute source of truth for the document state.
 * An append-only stream of CRDT (Yjs) operations.
 */
export class NoteUpdateLog {
  private readonly _seq: bigint;
  private readonly _noteId: NoteId;
  private readonly _authorId: UserId;

  constructor(
    seq: bigint,
    noteId: NoteId,
    public readonly updateBlob: Uint8Array,
    public readonly sizeBytes: number,
    authorId: UserId,
    public readonly createdAt: Date,
  ) {
    this._seq = seq;
    this._noteId = noteId;
    this._authorId = authorId;
  }

  get seq(): bigint { return this._seq; }
  get noteId(): string { return this._noteId; }
  get authorId(): string { return this._authorId; }

  static create(params: {
    seq: bigint;
    noteId: string;
    updateBlob: Uint8Array;
    sizeBytes: number;
    authorId: string;
    createdAt: Date;
  }): NoteUpdateLog {
    return new NoteUpdateLog(
      params.seq,
      NoteId.from(params.noteId),
      params.updateBlob,
      params.sizeBytes,
      UserId.from(params.authorId),
      params.createdAt,
    );
  }
}
