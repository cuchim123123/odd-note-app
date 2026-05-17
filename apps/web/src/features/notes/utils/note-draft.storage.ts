import { openNotesDb } from '../api/notes.storage';

export type LocalDraft = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export async function readLocalDraft(noteId: string): Promise<LocalDraft | null> {
  try {
    const db = await openNotesDb();
    const tx = db.transaction('drafts', 'readonly');
    const store = tx.objectStore('drafts');

    const draft = await new Promise<LocalDraft | null>((resolve, reject) => {
      const request = store.get(noteId);
      request.onsuccess = () => resolve((request.result as LocalDraft) || null);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return draft;
  } catch {
    return null;
  }
}

export async function writeLocalDraft(noteId: string, title: string, content: string): Promise<void> {
  try {
    const db = await openNotesDb();
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        id: noteId,
        title,
        content,
        updatedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch {
    // Ignore quota or private mode database errors.
  }
}

export async function clearLocalDraft(noteId: string): Promise<void> {
  try {
    const db = await openNotesDb();
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(noteId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch {
    // Ignore cleanup failures.
  }
}
