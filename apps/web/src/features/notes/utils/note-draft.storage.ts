const LOCAL_DRAFT_PREFIX = 'note-draft:';

export type LocalDraft = {
  title: string;
  content: string;
  updatedAt: string;
};

export function getLocalDraftKey(noteId: string): string {
  return `${LOCAL_DRAFT_PREFIX}${noteId}`;
}

export function readLocalDraft(noteId: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(getLocalDraftKey(noteId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    if (typeof parsed.title !== 'string' || typeof parsed.content !== 'string' || typeof parsed.updatedAt !== 'string') {
      return null;
    }

    return { title: parsed.title, content: parsed.content, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

export function writeLocalDraft(noteId: string, title: string, content: string): void {
  try {
    localStorage.setItem(getLocalDraftKey(noteId), JSON.stringify({ title, content, updatedAt: new Date().toISOString() }));
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

export function clearLocalDraft(noteId: string): void {
  try {
    localStorage.removeItem(getLocalDraftKey(noteId));
  } catch {
    // Ignore cleanup failures.
  }
}
