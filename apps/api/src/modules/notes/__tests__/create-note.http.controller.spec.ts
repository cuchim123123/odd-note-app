import { describe, expect, it, vi } from 'vitest';
import { createNoteSchema } from '@odd-note-app/validation';
import { CreateNoteCommand } from '@modules/notes/application/commands/create-note/create-note.command';
import { CreateNoteHttpController } from '@modules/notes/presentation/http/commands/create-note/create-note.http.controller';

describe('CreateNoteHttpController', () => {
  it('strips a client-supplied id before dispatching a server-generated create command', async () => {
    const commandBus = {
      execute: vi.fn().mockResolvedValue({ id: 'server-generated-note-id' }),
    };
    const controller = new CreateNoteHttpController(commandBus as never);
    const body = createNoteSchema.parse({
      id: '018f73ec-7f4c-7c6d-93db-20d4c9d2493b',
      title: 'New note',
    });

    await expect(controller.create('user-1', body)).resolves.toEqual({
      id: 'server-generated-note-id',
    });

    const command = commandBus.execute.mock.calls[0]![0] as CreateNoteCommand;
    expect(command.userId).toBe('user-1');
    expect(command.title).toBe('New note');
    expect(command).not.toHaveProperty('id');
  });
});
