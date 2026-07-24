export const DOCUMENT_SYNC_PORT = Symbol('DOCUMENT_SYNC_PORT');

export interface IDocumentSyncPort {
  readContent(noteId: string): Promise<string | null>;
  persistSnapshot(noteId: string, title: string, content: string | null, isPinned: boolean, updatedAt: Date): Promise<void>;
  clearState(noteId: string): Promise<void>;
}
