import type { INoteRepository } from '@modules/notes/application/ports/repositories/note.repository.port';
import type { INoteShareRepository } from '@modules/notes/application/ports/repositories/note-share.repository.port';
import type { INoteOutboxPort } from '@modules/notes/application/ports/messaging/note-outbox.port';
import type { INoteProtectionPort } from '@modules/notes/application/ports/services/note-protection.port';
import type { IUserPreferencesRepository } from '@modules/notes/application/ports/repositories/user-preferences.repository.port';
import type { INoteRevisionRepository } from '@modules/notes/application/ports/repositories/note-revision.repository.port';

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

