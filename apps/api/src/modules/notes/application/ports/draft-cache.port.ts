export const DRAFT_CACHE_PORT = Symbol('DRAFT_CACHE_PORT');

export interface NoteDraftDraft {
  title: string;
  content: string;
  updatedAt: string;
}

export interface IDraftCachePort {
  getDraft(userId: string, noteId: string): Promise<NoteDraftDraft | null>;
  saveDraft(userId: string, noteId: string, title: string, content: string): Promise<void>;
  clearDraft(userId: string, noteId: string): Promise<void>;
}
