import type { INoteRepository } from './note.repository.port';
import type { INoteShareRepository } from './note-share.repository.port';
import type { INoteOutboxPort } from './note-outbox.port';
import type { INoteProtectionPort } from './note-protection.port';
import type { IUserPreferencesRepository } from './user-preferences.repository.port';
import type { INoteRevisionRepository } from './note-revision.repository.port';

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

