import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NotePermissionDeniedError, IncorrectPasswordError } from '@modules/notes/domain/errors/note.errors';
import { GetDraftQuery } from '@modules/notes/application/queries/get-draft/get-draft.query';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '@modules/notes/application/ports/draft-cache.port';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '@modules/notes/application/ports/note-protection.port';
import type { NoteDraftResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_QUERY_DAO, type INoteQueryDao } from '@modules/notes/application/ports/note-query.dao.port';

@QueryHandler(GetDraftQuery)
export class GetDraftQueryHandler implements IQueryHandler<GetDraftQuery> {
  constructor(
    @Inject(NOTE_QUERY_DAO)
    private readonly noteQueryDao: INoteQueryDao,
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
  ) {}

  async execute(query: GetDraftQuery): Promise<NoteDraftResponseDto | null> {
    const { userId, noteId, unlockToken } = query;

    // Verify access for non-new notes
    if (noteId !== 'new') {
      const access = await this.noteQueryDao.checkAccess(noteId, userId);
      if (!access || (!access.isOwner && access.permission !== 'EDIT')) {
        throw new NotePermissionDeniedError('Note not found or you do not have edit permission');
      }

      // Check protection
      const protection = await this.noteQueryDao.isProtected(noteId, access.ownerId);

      if (protection) {
        const isUnlocked = await this.protectionPort.verifyUnlockToken(userId, noteId, unlockToken);
        if (!isUnlocked) throw new IncorrectPasswordError();
      }
    }

    return this.draftCachePort.getDraft(userId, noteId);
  }
}
