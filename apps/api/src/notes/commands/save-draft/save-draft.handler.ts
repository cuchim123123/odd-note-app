import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { SaveDraftCommand } from './save-draft.command';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '../../application/ports/draft-cache.port';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(SaveDraftCommand)
export class SaveDraftHandler implements ICommandHandler<SaveDraftCommand> {
  constructor(
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
    private readonly prisma: PrismaService, // Temporary until UoW
  ) {}

  async execute(command: SaveDraftCommand): Promise<void> {
    const { userId, noteId, title, content } = command;

    if (noteId !== 'new') {
      const existing = await this.prisma.note.findFirst({
        where: {
          id: noteId,
          OR: [{ userId }, { shares: { some: { recipientId: userId, permission: 'EDIT' } } }],
        },
      });

      if (!existing) {
        throw new UnauthorizedException('Note not found or you do not have permission to edit it');
      }
    }

    await this.draftCachePort.saveDraft(userId, noteId, title, content);
  }
}
