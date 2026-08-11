import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateNoteHandler } from '@modules/notes/application/commands/create-note/create-note.handler';
import { CreateNoteCommand } from '@modules/notes/application/commands/create-note/create-note.command';
import { NoteEntity } from '@modules/notes/domain/entities/note.entity';

// ─── Port Mocks ─────────────────────────────────────────────────────────────

function createMocks() {
  const noteRepository = {
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

  const documentUpdateStore = {
    append: vi.fn(),
  };

  const unitOfWork = {
    execute: vi.fn(async (work) => {
      return work({ 
        repos: { note: noteRepository, userPreferences: userPreferencesRepository },
        documentUpdateStore
      });
    }),
  };

  const documentEngine = {
    createInitialContent: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  };

  const handler = new CreateNoteHandler(
    unitOfWork as never,
    documentEngine as never,
  );

  return { handler, noteRepository, documentEngine, documentUpdateStore, userPreferencesRepository, unitOfWork };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CreateNoteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and persists a note aggregate, returns its id', async () => {
    const { handler, noteRepository } = createMocks();

    const result = await handler.execute(new CreateNoteCommand('user-1', 'My Note'));

    expect(noteRepository.create).toHaveBeenCalledTimes(1);
    expect(noteRepository.update).not.toHaveBeenCalled();

     
    const savedNote: NoteEntity = noteRepository.create.mock.calls[0]![0];
    expect(savedNote).toBeInstanceOf(NoteEntity);
    expect(savedNote.title).toBe('My Note');
    expect(savedNote.ownerId).toBe('user-1');

    expect(result.id).toBe(savedNote.id);
  });

  it('does NOT call documentEngine when no content is provided', async () => {
    const { handler, documentEngine, documentUpdateStore } = createMocks();

    await handler.execute(new CreateNoteCommand('user-1', 'Title Only'));

    expect(documentEngine.createInitialContent).not.toHaveBeenCalled();
    expect(documentUpdateStore.append).not.toHaveBeenCalled();
  });

  it('persists initial content to documentUpdateStore when provided', async () => {
    const { handler, documentEngine, documentUpdateStore } = createMocks();

    await handler.execute(new CreateNoteCommand('user-1', 'Rich Note', '<p>Hello</p>'));

    expect(documentEngine.createInitialContent).toHaveBeenCalledTimes(1);
    expect(documentEngine.createInitialContent).toHaveBeenCalledWith('<p>Hello</p>');

    expect(documentUpdateStore.append).toHaveBeenCalledTimes(1);
    const appendCall = documentUpdateStore.append.mock.calls[0]![0];
    expect(appendCall.authorId).toBe('user-1');
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
