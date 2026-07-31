import type { INoteRepository } from '@modules/notes/application/ports/repositories/note.repository.port';
import type { INoteShareRepository } from '@modules/notes/application/ports/repositories/note-share.repository.port';
import type { INoteOutboxPort } from '@modules/notes/application/ports/messaging/note-outbox.port';
import type { INoteProtectionPort } from '@modules/notes/application/ports/external/note-protection.port';
import type { IUserPreferencesRepository } from '@modules/notes/application/ports/repositories/user-preferences.repository.port';
import type { IVersionHistoryRepository } from '@modules/notes/application/ports/repositories/version-history.repository.port';

export interface NoteTransactionContext {
  repos: {
    note: INoteRepository;
    noteShare: INoteShareRepository;
    userPreferences: IUserPreferencesRepository;
    versionHistory: IVersionHistoryRepository;
  };
  outbox: INoteOutboxPort;
  protectionPort: INoteProtectionPort;
}

export interface INoteUnitOfWork {
  execute<T>(work: (ctx: NoteTransactionContext) => Promise<T>): Promise<T>;
}
export const NOTE_UNIT_OF_WORK = Symbol('NOTE_UNIT_OF_WORK');

