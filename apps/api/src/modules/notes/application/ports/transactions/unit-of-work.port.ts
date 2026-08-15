import type { INoteRepository } from '@modules/notes/application/ports/repositories/note.repository.port';
import type { INoteOutboxPort } from '@modules/notes/application/ports/messaging/note-outbox.port';
import type { INoteProtectionPort } from '@modules/notes/application/ports/external/note-protection.port';
import type { IUserNotePreferenceStore } from '@modules/notes/application/ports/stores/user-note-preference.store.port';
import type { INoteRevisionStore } from '@modules/notes/application/ports/stores/note-revision.store.port';
import type { IDocumentUpdateStore } from '@modules/notes/application/ports/stores/document-update.store.port';

export interface NoteTransactionContext {
  repos: {
    note: INoteRepository;
  };
  stores: {
    userNotePreference: IUserNotePreferenceStore;
    noteRevision: INoteRevisionStore;
    documentUpdate: IDocumentUpdateStore;
  };
  outbox: INoteOutboxPort;
  protectionPort: INoteProtectionPort;
}

export interface INoteUnitOfWork {
  execute<T>(work: (ctx: NoteTransactionContext) => Promise<T>): Promise<T>;
}
export const NOTE_UNIT_OF_WORK = Symbol('NOTE_UNIT_OF_WORK');

