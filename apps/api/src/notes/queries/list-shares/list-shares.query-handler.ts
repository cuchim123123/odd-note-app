import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ListSharesQuery } from './list-shares.query';
import type { NoteShareResponseDto } from '../../presentation/dto/note.response.dto';
import { PrismaService } from '../../../prisma/prisma.service';

@QueryHandler(ListSharesQuery)
export class ListSharesQueryHandler implements IQueryHandler<ListSharesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListSharesQuery): Promise<NoteShareResponseDto[]> {
    const { userId, noteId } = query;

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId }, // Only the owner can list shares
    });

    if (!note) throw new NotFoundException('Note not found or you do not have permission to view its shares');

    const shares = await this.prisma.noteShare.findMany({
      where: { noteId },
      include: { recipient: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return shares.map((s) => ({
      id: s.id,
      recipientEmail: s.recipientEmail,
      recipientDisplayName: s.recipient?.displayName ?? undefined,
      permission: s.permission as 'READ' | 'EDIT',
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }
}
