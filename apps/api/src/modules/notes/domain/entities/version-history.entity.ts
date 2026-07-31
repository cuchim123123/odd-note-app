import { AggregateRoot } from '@shared/domain/ddd/aggregate-root';
import { NoteId } from '@shared/domain/ddd/id-types';
import { NoteRevisionEntity } from './note-revision.entity';
import { uuidv7 } from 'uuidv7';

export class VersionHistory extends AggregateRoot {
  private readonly _noteId: NoteId;
  private readonly _revisions: NoteRevisionEntity[];

  constructor(noteId: NoteId, revisions: NoteRevisionEntity[] = []) {
    super();
    this._noteId = noteId;
    this._revisions = revisions;
  }

  get noteId(): string { return this._noteId; }
  get revisions(): ReadonlyArray<NoteRevisionEntity> { return this._revisions; }

  /**
   * Adds a new revision to the history. 
   * Idempotent: If a revision for the targetSeq already exists, returns the existing one.
   */
  public addRevision(targetSeq: bigint, createdBy: string, label?: string | null): NoteRevisionEntity {
    const existing = this._revisions.find((r) => r.targetSeq === targetSeq);
    if (existing) {
      return existing;
    }

    const revision = NoteRevisionEntity.create({
      id: uuidv7(),
      noteId: this._noteId,
      targetSeq,
      createdAt: new Date(),
      createdBy,
      label: label ?? null,
    });
    
    this._revisions.push(revision);
    // this.addDomainEvent(new RevisionCreatedDomainEvent(...)); // If needed in future
    return revision;
  }

  public getRevision(revisionId: string): NoteRevisionEntity | undefined {
    return this._revisions.find(r => r.id === revisionId);
  }

  static load(noteId: string, revisions: NoteRevisionEntity[]): VersionHistory {
    return new VersionHistory(NoteId.from(noteId), revisions);
  }
}
