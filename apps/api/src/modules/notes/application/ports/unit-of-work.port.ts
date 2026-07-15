import type { INoteRepository } from '@modules/notes/application/ports/note.repository.port';
import type { INoteShareRepository } from '@modules/notes/application/ports/note-share.repository.port';
import type { INoteOutboxPort } from '@modules/notes/application/ports/note-outbox.port';
import type { INoteProtectionPort } from '@modules/notes/application/ports/note-protection.port';
import type { IUserPreferencesRepository } from '@modules/notes/application/ports/user-preferences.repository.port';
import type { INoteRevisionRepository } from '@modules/notes/application/ports/note-revision.repository.port';

export interface NoteTransactionContext {
  noteRepository: INoteRepository;
  noteShareRepository: INoteShareRepository;
  outbox: INoteOutboxPort;
  protectionPort: INoteProtectionPort;
  userPreferencesRepository: IUserPreferencesRepository;
  revisionRepository: INoteRevisionRepository;
}

export interface INoteUnitOfWork {
  execute<T>(work: (ctx: NoteTransactionContext) => Promise<T>): Promise<T>;
}
export const NOTE_UNIT_OF_WORK = Symbol('NOTE_UNIT_OF_WORK');

