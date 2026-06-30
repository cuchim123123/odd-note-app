/**
 * NoteRevisionEntity — a value-like read model for a historical snapshot.
 *
 * Revisions are immutable once created: content at a point in time.
 * They are NOT aggregate roots (no domain events, no mutable state).
 */
export class NoteRevisionEntity {
  constructor(
    public readonly id: string,
    public readonly noteId: string,
    public readonly revisionNumber: number,
    public readonly title: string,
    public readonly content: string,
    public readonly createdAt: Date,
    public readonly createdBy: string,
    public readonly label: string | null,
  ) {}

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
      params.noteId,
      params.revisionNumber,
      params.title,
      params.content,
      params.createdAt,
      params.createdBy,
      params.label ?? null,
    );
  }
}
