import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IInternalCommandHandler } from '@shared/infrastructure/outbox/internal-command-handler.port';
import { AI_TAGGING_PROVIDER_PORT, type IAITaggingProviderPort } from '@modules/notes/application/ports/external/ai-tagging-provider.port';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateNoteAITagsCommand } from '@modules/notes/application/commands/update-note-ai-tags/update-note-ai-tags.command';

interface GenerateNoteAITagsPayload {
  noteId: string;
  plainText: string;
  targetSeq: string;
}

@Injectable()
export class GenerateNoteAITagsInternalHandler implements IInternalCommandHandler {
  private readonly logger = new Logger(GenerateNoteAITagsInternalHandler.name);

  constructor(
    @Inject(AI_TAGGING_PROVIDER_PORT)
    private readonly taggingProvider: IAITaggingProviderPort,
    private readonly commandBus: CommandBus,
  ) {}

  canHandle(topic: string): boolean {
    return topic === 'GenerateNoteAITags';
  }

  async handle(topic: string, payload: unknown): Promise<void> {
    if (topic !== 'GenerateNoteAITags') return;
    
    const { noteId, plainText, targetSeq } = payload as unknown as GenerateNoteAITagsPayload;
    
    this.logger.log(`Processing GenerateNoteAITags for note ${noteId} at seq ${targetSeq}`);

    // Generate tags using provider
    const aiTags = await this.taggingProvider.generateTags(plainText);

    // Update the domain aggregate. The UpdateNoteAITagsCommand handler
    // will enforce optimistic concurrency using targetSeq, filter out
    // rejected tags, and publish the NoteAITagsUpdatedDomainEvent.
    await this.commandBus.execute(new UpdateNoteAITagsCommand(noteId, aiTags, targetSeq));
  }
}
