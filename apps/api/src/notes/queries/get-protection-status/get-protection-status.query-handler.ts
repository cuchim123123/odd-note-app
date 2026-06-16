import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { GetProtectionStatusQuery } from './get-protection-status.query';
import type { ProtectionStatusResponseDto } from '../../presentation/dto/note.response.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@QueryHandler(GetProtectionStatusQuery)
export class GetProtectionStatusQueryHandler implements IQueryHandler<GetProtectionStatusQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetProtectionStatusQuery): Promise<ProtectionStatusResponseDto> {
    const { userId, noteId } = query;

    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { userId: true },
    });

    if (!note) throw new NotFoundException('Note not found');

    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: note.userId, noteId } },
      select: { id: true },
    });

    return { isProtected: Boolean(protection) };
  }
}
