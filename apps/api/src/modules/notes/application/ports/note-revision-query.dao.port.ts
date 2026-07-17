import type { NoteRevisionSummaryDto } from '@modules/notes/presentation/http/dto/note-revision-summary.dto';

export const NOTE_REVISION_QUERY_DAO = Symbol('NOTE_REVISION_QUERY_DAO');

export interface INoteRevisionQueryDao {
  /**
   * Lists all revisions for a note, newest first.
   * Returns DTOs (summaries without content).
   */
  findByNoteId(noteId: string): Promise<NoteRevisionSummaryDto[]>;
}
