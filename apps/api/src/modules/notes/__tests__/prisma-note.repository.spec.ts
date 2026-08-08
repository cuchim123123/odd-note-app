import { describe, expect, it, vi } from 'vitest';
import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';
import { PrismaNoteRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-note.repository';

describe('PrismaNoteRepository', () => {
  it('inserts a new note and never uses an upsert update branch', async () => {
    const prisma = {
      note: {
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn(),
      },
    };
    const repository = new PrismaNoteRepository(prisma as never);
    const note = NoteEntity.create('user-1', NoteTitle.create('Server-generated note'));

    await repository.create(note);

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: note.id,
        userId: 'user-1',
        title: 'Server-generated note',
      }),
    });
    expect(prisma.note.update).not.toHaveBeenCalled();
    expect(prisma.note.upsert).not.toHaveBeenCalled();
  });
});
