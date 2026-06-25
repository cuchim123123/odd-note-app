import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteSharedKafkaController } from '../application/events/handlers/note-shared.kafka.controller';
import { CreateNotificationCommand } from '../application/commands/create-notification/create-notification.command';

// ─── Mocks ───────────────────────────────────────────────────────────────────

function createMocks() {
  const commandBus = {
    execute: vi.fn().mockResolvedValue(undefined),
  };

  const controller = new NoteSharedKafkaController(commandBus as never);

  return { controller, commandBus };
}

const validPayload = {
  noteId: 'note-1',
  shareId: 'share-abc',
  ownerId: 'owner-1',
  recipientId: 'recipient-1',
  recipientEmail: 'recipient@example.com',
  permission: 'READ',
  noteTitle: 'My Secret Project',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NoteSharedKafkaController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches CreateNotificationCommand with correct userId (recipientId)', async () => {
    const { controller, commandBus } = createMocks();

    await controller.handleNoteSharedEvent(validPayload);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    const cmd: CreateNotificationCommand = commandBus.execute.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(CreateNotificationCommand);
    expect(cmd.userId).toBe('recipient-1');
  });

  it('sets notification type to "note_shared"', async () => {
    const { controller, commandBus } = createMocks();

    await controller.handleNoteSharedEvent(validPayload);

    const cmd: CreateNotificationCommand = commandBus.execute.mock.calls[0][0];
    expect(cmd.type).toBe('note_shared');
  });

  it('sets notification title to "Note Shared"', async () => {
    const { controller, commandBus } = createMocks();

    await controller.handleNoteSharedEvent(validPayload);

    const cmd: CreateNotificationCommand = commandBus.execute.mock.calls[0][0];
    expect(cmd.title).toBe('Note Shared');
  });

  it('builds a human-readable message containing the note title and permission', async () => {
    const { controller, commandBus } = createMocks();

    await controller.handleNoteSharedEvent(validPayload);

    const cmd: CreateNotificationCommand = commandBus.execute.mock.calls[0][0];
    expect(cmd.message).toContain('My Secret Project');
    expect(cmd.message).toContain('READ');
  });

  it('attaches noteId, shareId, and permission to the notification data', async () => {
    const { controller, commandBus } = createMocks();

    await controller.handleNoteSharedEvent(validPayload);

    const cmd: CreateNotificationCommand = commandBus.execute.mock.calls[0][0];
    expect(cmd.data).toMatchObject({
      noteId: 'note-1',
      shareId: 'share-abc',
      permission: 'READ',
    });
  });

  it('correctly handles EDIT permission in message and data', async () => {
    const { controller, commandBus } = createMocks();

    await controller.handleNoteSharedEvent({ ...validPayload, permission: 'EDIT' });

    const cmd: CreateNotificationCommand = commandBus.execute.mock.calls[0][0];
    expect(cmd.message).toContain('EDIT');
    expect(cmd.data).toMatchObject({ permission: 'EDIT' });
  });
});
