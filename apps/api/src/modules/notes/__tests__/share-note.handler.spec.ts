import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareNoteHandler } from '@modules/notes/application/commands/share-note/share-note.handler';
import { ShareNoteCommand } from '@modules/notes/application/commands/share-note/share-note.command';
import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { RecipientNotFoundError, SelfShareError } from '@modules/notes/domain/errors/share.errors';
import { NoteAlreadySharedError } from '@modules/notes/domain/errors/note.errors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildNote(ownerId = 'owner-1') {
  return NoteEntity.create(ownerId, NoteTitle.create('Test Note'));
}

function createMocks(overrides: { noteToReturn?: NoteEntity | null } = {}) {
  const note = overrides.noteToReturn !== undefined ? overrides.noteToReturn : buildNote();

  const noteRepository = {
    findById: vi.fn().mockResolvedValue(note),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  };

  const noteShareRepository = {
    create: vi.fn().mockResolvedValue({ id: 'share-abc' }),
    updatePermission: vi.fn(),
    delete: vi.fn(),
  };

  const outbox = {
    scheduleIntegrationEvent: vi.fn().mockResolvedValue(undefined),
  };

  const userReadPort = {
    findByEmail: vi.fn().mockResolvedValue({ id: 'recipient-1', email: 'recipient@example.com' }),
    findById: vi.fn().mockResolvedValue({ id: 'owner-1', displayName: 'Owner One' }),
  };

  const mailer = {
    sendNoteSharedEmail: vi.fn().mockResolvedValue(undefined),
  };

  const integrationEventMapper = {
    serialize: vi.fn().mockReturnValue({ topic: 'note-shared', payload: {} }),
  };

  const unitOfWork = {
    execute: vi.fn(async (work) => {
      return work({ noteRepository, noteShareRepository, outbox });
    }),
  };

  const handler = new ShareNoteHandler(
    unitOfWork as never,
    userReadPort as never,
    mailer as never,
    integrationEventMapper as never,
  );

  return { handler, noteRepository, noteShareRepository, outbox, userReadPort, mailer, integrationEventMapper, note, unitOfWork };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ShareNoteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully shares a note and returns the share id', async () => {
    const { handler, noteShareRepository } = createMocks();

    const result = await handler.execute(
      new ShareNoteCommand('owner-1', 'note-1', 'recipient@example.com', 'READ'),
    );

    expect(noteShareRepository.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('share-abc');
  });

  it('throws NoteNotFoundError when note does not exist', async () => {
    const { handler } = createMocks({ noteToReturn: null });

    await expect(
      handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'recipient@example.com', 'READ')),
    ).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  it('throws RecipientNotFoundError when recipient email does not exist', async () => {
    const { handler, userReadPort } = createMocks();
    userReadPort.findByEmail.mockResolvedValue(null);

    await expect(
      handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'nobody@example.com', 'READ')),
    ).rejects.toBeInstanceOf(RecipientNotFoundError);
  });

  it('throws SelfShareError when owner tries to share with themselves', async () => {
    const { handler, userReadPort } = createMocks();
    // recipient id == owner id
    userReadPort.findByEmail.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' });

    await expect(
      handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'owner@example.com', 'READ')),
    ).rejects.toBeInstanceOf(SelfShareError);
  });

  it('throws NoteAlreadySharedError when note is already shared with that recipient', async () => {
    const note = buildNote('owner-1');
    const { handler, userReadPort } = createMocks({ noteToReturn: note });

    // First share succeeds
    await handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'recipient@example.com', 'READ'));
    vi.clearAllMocks();

    // Restore mocks — same note still in memory with the share registered
    userReadPort.findByEmail.mockResolvedValue({ id: 'recipient-1', email: 'recipient@example.com' });

    // Second share to the same recipient must fail
    await expect(
      handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'recipient@example.com', 'EDIT')),
    ).rejects.toBeInstanceOf(NoteAlreadySharedError);
  });

  it('saves the aggregate after shareWith mutates it', async () => {
    const { handler, noteRepository } = createMocks();

    await handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'recipient@example.com', 'READ'));

    expect(noteRepository.save).toHaveBeenCalledTimes(1);
     
    const savedNote: NoteEntity = noteRepository.save.mock.calls[0]![0];
    expect(savedNote.isShared).toBe(true);
    expect(savedNote.shares).toHaveLength(1);
  });

  it('raises NoteSharedDomainEvent in the aggregate', async () => {
    const { handler, note } = createMocks();

    await handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'recipient@example.com', 'EDIT'));

    expect(note!.domainEvents.length).toBeGreaterThan(0);
    const event = note!.domainEvents.find(e => e.constructor.name === 'NoteSharedDomainEvent') ;
    expect(event).toBeDefined();
    expect(event).toMatchObject({
      ownerId: 'owner-1',
      recipientId: 'recipient-1',
      recipientEmail: 'recipient@example.com',
      permission: 'EDIT',
    });
  });

  it('sends the notification email', async () => {
    const { handler, mailer } = createMocks();

    await handler.execute(new ShareNoteCommand('owner-1', 'note-1', 'recipient@example.com', 'READ'));

    expect(mailer.sendNoteSharedEmail).toHaveBeenCalledTimes(1);
     
    expect(mailer.sendNoteSharedEmail.mock.calls[0]![0]).toMatchObject({
      to: 'recipient@example.com',
      senderName: 'Owner One',
    });
  });
});
