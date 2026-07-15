import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NotePermissionDeniedError, IncorrectPasswordError } from '../../../domain/errors/note.errors';
import { GetDraftQuery } from './get-draft.query';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '../../ports/draft-cache.port';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../ports/note-protection.port';
import type { NoteDraftResponseDto } from '../../../presentation/http/dto/note.response.dto';
import { PrismaService } from '../../../../../infrastructure/prisma/prisma.service';

@QueryHandler(GetDraftQuery)
export class GetDraftQueryHandler implements IQueryHandler<GetDraftQuery> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
  ) {}

  async execute(query: GetDraftQuery): Promise<NoteDraftResponseDto | null> {
    const { userId, noteId, unlockToken } = query;

    // Verify access for non-new notes
    if (noteId !== 'new') {
      const note = await this.prisma.note.findFirst({
        where: {
          id: noteId,
          OR: [{ userId }, { shares: { some: { recipientId: userId, permission: 'EDIT' } } }],
        },
        select: { id: true },
      });

      if (!note) throw new NotePermissionDeniedError('Note not found or you do not have edit permission');

      // Check protection
      const protection = await this.prisma.noteProtection.findFirst({
        where: { noteId },
        select: { id: true },
      });

      if (protection) {
        const isUnlocked = await this.protectionPort.verifyUnlockToken(userId, noteId, unlockToken);
        if (!isUnlocked) throw new IncorrectPasswordError();
      }
    }

    return this.draftCachePort.getDraft(userId, noteId);
  }
}
