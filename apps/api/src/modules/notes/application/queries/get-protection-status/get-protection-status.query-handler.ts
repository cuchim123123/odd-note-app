import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { GetProtectionStatusQuery } from '@modules/notes/application/queries/get-protection-status/get-protection-status.query';
import type { ProtectionStatusResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/note-query.dao.port';
import { Inject } from '@nestjs/common';

@QueryHandler(GetProtectionStatusQuery)
export class GetProtectionStatusQueryHandler implements IQueryHandler<GetProtectionStatusQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
  ) {}

  async execute(query: GetProtectionStatusQuery): Promise<ProtectionStatusResponseDto> {
    const { userId, noteId } = query;

    const access = await this.noteQueryDao.checkAccess(noteId, userId);
    if (!access) throw new NoteNotFoundError(noteId);

    const protection = await this.noteQueryDao.isProtected(noteId, access.ownerId);

    return { isProtected: Boolean(protection) };
  }
}
