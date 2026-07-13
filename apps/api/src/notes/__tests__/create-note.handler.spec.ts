import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateNoteHandler } from '../application/commands/create-note/create-note.handler';
import { CreateNoteCommand } from '../application/commands/create-note/create-note.command';
import { NoteEntity } from '../domain/entities/note.entity';

// ─── Port Mocks ─────────────────────────────────────────────────────────────

function createMocks() {
  const noteRepository = {
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  
  const userPreferencesRepository = {
    upsertPin: vi.fn(),
    getPin: vi.fn(),
    upsertLabel: vi.fn(),
    createLabel: vi.fn(),
    renameLabel: vi.fn(),
    deleteLabel: vi.fn(),
  };

  const unitOfWork = {
    execute: vi.fn(async (work) => {
      return work({ noteRepository, userPreferencesRepository });
    }),
  };

  const documentSyncPort = {
    persistSnapshot: vi.fn(),
    clearState: vi.fn(),
  };

  const draftCachePort = {
    saveDraft: vi.fn(),
    getDraft: vi.fn(),
    clearDraft: vi.fn(),
  };

  const handler = new CreateNoteHandler(
    unitOfWork as never,
    documentSyncPort as never,
    draftCachePort as never,
  );

  return { handler, noteRepository, documentSyncPort, draftCachePort, userPreferencesRepository, unitOfWork };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CreateNoteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and persists a note aggregate, returns its id', async () => {
    const { handler, noteRepository } = createMocks();

    const result = await handler.execute(new CreateNoteCommand('user-1', 'My Note'));

    expect(noteRepository.save).toHaveBeenCalledTimes(1);

     
    const savedNote: NoteEntity = noteRepository.save.mock.calls[0]![0];
    expect(savedNote).toBeInstanceOf(NoteEntity);
    expect(savedNote.title).toBe('My Note');
    expect(savedNote.ownerId).toBe('user-1');

    expect(result.id).toBe(savedNote.id);
  });

  it('does NOT call documentSyncPort when no content is provided', async () => {
    const { handler, documentSyncPort } = createMocks();

    await handler.execute(new CreateNoteCommand('user-1', 'Title Only'));

    expect(documentSyncPort.persistSnapshot).not.toHaveBeenCalled();
  });

  it('persists initial content to documentSyncPort when provided', async () => {
    const { handler, documentSyncPort } = createMocks();

    await handler.execute(new CreateNoteCommand('user-1', 'Rich Note', '<p>Hello</p>'));

    expect(documentSyncPort.persistSnapshot).toHaveBeenCalledTimes(1);
     
    const [, title, content] = documentSyncPort.persistSnapshot.mock.calls[0]!;
    expect(title).toBe('Rich Note');
    expect(content).toBe('<p>Hello</p>');
  });

  it('creates label record when labels are provided', async () => {
    const { handler, userPreferencesRepository } = createMocks();

    await handler.execute(new CreateNoteCommand('user-1', 'Labeled', undefined, ['work', 'urgent']));

    expect(userPreferencesRepository.createLabel).toHaveBeenCalledTimes(1);
     
    const [userId, , labels] = userPreferencesRepository.createLabel.mock.calls[0]!;
    expect(userId).toBe('user-1');
    expect(labels).toEqual(['work', 'urgent']);
  });

  it('does NOT create label record when no labels are provided', async () => {
    const { handler, userPreferencesRepository } = createMocks();

    await handler.execute(new CreateNoteCommand('user-1', 'No Labels'));

    expect(userPreferencesRepository.createLabel).not.toHaveBeenCalled();
  });

  it('always clears the draft for "new" note key after creation', async () => {
    const { handler, draftCachePort } = createMocks();

    await handler.execute(new CreateNoteCommand('user-1', 'Draft Clear Test'));

    expect(draftCachePort.clearDraft).toHaveBeenCalledWith('user-1', 'new');
  });

  it('enforces NoteTitle domain invariant — throws on empty title', async () => {
    const { handler } = createMocks();

    await expect(
      handler.execute(new CreateNoteCommand('user-1', '')),
    ).rejects.toThrow();
  });

  it('enforces NoteTitle domain invariant — throws on title exceeding max length', async () => {
    const { handler } = createMocks();

    const tooLong = 'a'.repeat(501); // NoteTitle max is 500 chars
    await expect(
      handler.execute(new CreateNoteCommand('user-1', tooLong)),
    ).rejects.toThrow();
  });
});
