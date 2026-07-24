import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListNotesQuery } from '@modules/notes/application/queries/list-notes/list-notes.query';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/external/document-sync.port';
import type { NoteResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/dao/note-query.dao.port';

/**
 * Query handler: bypass domain and repository, query DB directly for read performance.
 * Per reference architecture: "In read model we can bypass domain and repository layers completely."
 */
@QueryHandler(ListNotesQuery)
export class ListNotesQueryHandler implements IQueryHandler<ListNotesQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(query: ListNotesQuery): Promise<NoteResponseDto[]> {
    const { userId } = query;

    const enriched = await this.noteQueryDao.findUserNotes(userId);

    // Resolve content from Yjs/Redis for each note
    return Promise.all(
      enriched.map(async (note) => {
        const content = await this.documentSyncPort.readContent(note.id);
        return {
          ...note,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
          sharedAt: note.sharedAt?.toISOString(),
          content: content ?? note.content ?? '',
        };
      }),
    );
  }
}
