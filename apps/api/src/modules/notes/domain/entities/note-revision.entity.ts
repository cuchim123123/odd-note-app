import { NoteId, UserId } from '@shared/domain/ddd/id-types';
import { AggregateRoot } from '@shared/domain/ddd/aggregate-root';

/**
 * NoteRevisionEntity — a logical checkpoint in the note's history.
 * It contains NO document state. It acts strictly as a pointer (targetSeq)
 * to a specific point in the append-only NoteUpdate log.
 */
export class NoteRevisionEntity extends AggregateRoot {
  private readonly _id: string;
  private readonly _noteId: NoteId;
  private readonly _createdBy: UserId;
  private readonly _targetSeq: bigint;

  constructor(
    id: string,
    noteId: NoteId,
    targetSeq: bigint,
    public readonly createdAt: Date,
    createdBy: UserId,
    public readonly label: string | null,
  ) {
    super();
    this._id = id;
    this._noteId = noteId;
    this._targetSeq = targetSeq;
    this._createdBy = createdBy;
  }

  get id(): string { return this._id; }
  get noteId(): string { return this._noteId; }
  get createdBy(): string { return this._createdBy; }
  get targetSeq(): bigint { return this._targetSeq; }

  static create(params: {
    id: string;
    noteId: string;
    targetSeq: bigint;
    createdAt: Date;
    createdBy: string;
    label?: string | null;
  }): NoteRevisionEntity {
    return new NoteRevisionEntity(
      params.id,
      NoteId.from(params.noteId),
      params.targetSeq,
      params.createdAt,
      UserId.from(params.createdBy),
      params.label ?? null,
    );
  }
}
