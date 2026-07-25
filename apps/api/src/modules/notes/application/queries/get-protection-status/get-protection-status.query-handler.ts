import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { GetProtectionStatusQuery } from '@modules/notes/application/queries/get-protection-status/get-protection-status.query';
import type { ProtectionStatusResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { NOTE_ACCESS_PORT, type INoteAccessPort } from '@modules/notes/application/ports/security/note-access.port';

@QueryHandler(GetProtectionStatusQuery)
export class GetProtectionStatusQueryHandler implements IQueryHandler<GetProtectionStatusQuery> {
  constructor(
    @Inject(NOTE_ACCESS_PORT)
    private readonly noteAccessPort: INoteAccessPort,
  ) {}

  async execute(query: GetProtectionStatusQuery): Promise<ProtectionStatusResponseDto> {
    const { userId, noteId } = query;

    const access = await this.noteAccessPort.checkAccess(noteId, userId);
    if (!access) throw new NoteNotFoundError(noteId);

    const protection = await this.noteAccessPort.isProtected(noteId, access.ownerId);

    return { isProtected: Boolean(protection) };
  }
}
