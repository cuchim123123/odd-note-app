import type { Note } from '@odd-note-app/validation';

const NOTES_DB_NAME = 'odd-note-app';
const NOTES_DB_VERSION = 4;
const NOTES_STORE_NAME = 'notes';

const cloneNote = (note: Note): Note => ({ ...note, labels: [...(note.labels || [])] });

export const openNotesDb = async (): Promise<IDBDatabase> => {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(NOTES_DB_NAME, NOTES_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTES_STORE_NAME)) {
        db.createObjectStore(NOTES_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const readAllNotesFromDb = async (): Promise<Note[]> => {
  try {
    const db = await openNotesDb();
    const tx = db.transaction(NOTES_STORE_NAME, 'readonly');
    const store = tx.objectStore(NOTES_STORE_NAME);

    const notes = await new Promise<Note[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as Note[]).map(cloneNote));
      request.onerror = () => reject(request.error);
    });

    db.close();
    return notes;
  } catch {
    return [];
  }
};

export const readNoteFromDb = async (id: string): Promise<Note | null> => {
  try {
    const db = await openNotesDb();
    const tx = db.transaction(NOTES_STORE_NAME, 'readonly');
    const store = tx.objectStore(NOTES_STORE_NAME);

    const note = await new Promise<Note | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? cloneNote(request.result as Note) : null);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return note;
  } catch {
    return null;
  }
};

export const upsertNoteInDb = async (note: Note): Promise<void> => {
  try {
    const db = await openNotesDb();

    // Smart merge: Fetch the existing cached record first using a readonly transaction
    const existing = await new Promise<Note | null>((resolve) => {
      const tx = db.transaction(NOTES_STORE_NAME, 'readonly');
      const store = tx.objectStore(NOTES_STORE_NAME);
      const req = store.get(note.id || '');
      req.onsuccess = () => resolve(req.result ? cloneNote(req.result as Note) : null);
      req.onerror = () => resolve(null);
    });

    // If the new record comes from a projected list query (content is omitted/undefined),
    // preserve the existing cached rich-text body.
    const mergedNote = {
      ...note,
      content: (note.content === undefined && existing?.content
        ? existing.content
        : note.content) ?? '',
    };

    // Write the merged record using a fresh readwrite transaction
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(NOTES_STORE_NAME);
      const request = store.put(mergedNote);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (err) {
    console.error('Failed to upsert note in IndexedDB:', err);
  }
};

export const upsertNotesInDb = async (notes: Note[]): Promise<void> => {
  await Promise.all(notes.map((note) => upsertNoteInDb(note)));
};

export const deleteNoteFromDb = async (id: string): Promise<void> => {
  try {
    const db = await openNotesDb();
    const tx = db.transaction(NOTES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(NOTES_STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch {
    // Ignore offline cache write failures.
  }
};

export const clearAllOfflineData = async (): Promise<void> => {
  try {
    const db = await openNotesDb();
    const stores = [NOTES_STORE_NAME, 'syncQueue', 'metadata', 'drafts'];
    const tx = db.transaction(stores, 'readwrite');
    for (const storeName of stores) {
      if (db.objectStoreNames.contains(storeName)) {
        tx.objectStore(storeName).clear();
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('Failed to clear offline IndexedDB data:', err);
  }
};
