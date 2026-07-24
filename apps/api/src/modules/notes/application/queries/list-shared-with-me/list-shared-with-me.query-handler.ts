 
import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListSharedWithMeQuery } from '@modules/notes/application/queries/list-shared-with-me/list-shared-with-me.query';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/services/document-sync.port';
import type { SharedNoteResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/dao/note-query.dao.port';

@QueryHandler(ListSharedWithMeQuery)
export class ListSharedWithMeQueryHandler implements IQueryHandler<ListSharedWithMeQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(query: ListSharedWithMeQuery): Promise<SharedNoteResponseDto[]> {
    const { userId } = query;

    const enriched = await this.noteQueryDao.findSharedWithMe(userId);

    return Promise.all(
      enriched.map(async (share) => {
        const content = await this.documentSyncPort.readContent(share.id);
        return {
          ...share,
          content: content ?? share.content ?? '',
        };
      }),
    );
  }
}
