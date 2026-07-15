import { NoteId, UserId } from '@shared/domain/ddd/id-types';

/**
 * NoteRevisionEntity — an immutable snapshot of note content at a point in time.
 * Internal IDs are branded; getters return plain strings for serialisation.
 */
export class NoteRevisionEntity {
  private readonly _id: string;
  private readonly _noteId: NoteId;
  private readonly _createdBy: UserId;

  constructor(
    id: string,
    noteId: NoteId,
    public readonly revisionNumber: number,
    public readonly title: string,
    public readonly content: string,
    public readonly createdAt: Date,
    createdBy: UserId,
    public readonly label: string | null,
  ) {
    this._id = id;
    this._noteId = noteId;
    this._createdBy = createdBy;
  }

  get id(): string { return this._id; }
  get noteId(): string { return this._noteId; }
  get createdBy(): string { return this._createdBy; }

  static create(params: {
    id: string;
    noteId: string;
    revisionNumber: number;
    title: string;
    content: string;
    createdAt: Date;
    createdBy: string;
    label?: string | null;
  }): NoteRevisionEntity {
    return new NoteRevisionEntity(
      params.id,
      NoteId.from(params.noteId),
      params.revisionNumber,
      params.title,
      params.content,
      params.createdAt,
      UserId.from(params.createdBy),
      params.label ?? null,
    );
  }
}
