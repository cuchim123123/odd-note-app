import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ClearDraftCommand } from '@modules/notes/application/commands/clear-draft/clear-draft.command';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '@modules/notes/application/ports/draft-cache.port';

@CommandHandler(ClearDraftCommand)
export class ClearDraftHandler implements ICommandHandler<ClearDraftCommand> {
  constructor(
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
  ) {}

  async execute(command: ClearDraftCommand): Promise<void> {
    const { userId, noteId } = command;
    await this.draftCachePort.clearDraft(userId, noteId);
  }
}
