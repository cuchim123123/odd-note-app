import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { GetNoteByIdQuery } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/external/document-sync.port';
import type { NoteResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/dao/note-query.dao.port';

@QueryHandler(GetNoteByIdQuery)
export class GetNoteByIdQueryHandler implements IQueryHandler<GetNoteByIdQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(query: GetNoteByIdQuery): Promise<NoteResponseDto> {
    const { userId, noteId } = query;

    const note = await this.noteQueryDao.findNoteById(noteId, userId);
    if (!note) throw new NoteNotFoundError(noteId);

    const content = await this.documentSyncPort.readContent(noteId) ?? '';

    return {
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      sharedAt: note.sharedAt?.toISOString(),
      content,
    };
  }
}
