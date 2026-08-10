import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListNotesQueryHandler } from '@modules/notes/application/queries/list-notes/list-notes.query-handler';
import { ListNotesQuery } from '@modules/notes/application/queries/list-notes/list-notes.query';

describe('ListNotesQueryHandler', () => {
  let handler: ListNotesQueryHandler;
  let noteQueryDao: any;
  let documentSyncPort: any;
  let protectionPort: any;

  beforeEach(() => {
    noteQueryDao = {
      findUserNotes: vi.fn(),
    };
    documentSyncPort = {
      readContent: vi.fn(),
    };
    protectionPort = {
      getProtectedNoteIds: vi.fn(),
    };

    handler = new ListNotesQueryHandler(
      noteQueryDao,
      documentSyncPort,
      protectionPort,
    );
  });

  it('owner + unprotected note → content returned', async () => {
    const userId = 'user-1';
    noteQueryDao.findUserNotes.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: false, content: 'fallback', createdAt: new Date(), updatedAt: new Date() }
    ]);
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set());
    documentSyncPort.readContent.mockResolvedValue('redis-content');

    const result = await handler.execute(new ListNotesQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(false);
    expect(result[0]!.content).toBe('redis-content');
    expect(documentSyncPort.readContent).toHaveBeenCalledWith('note-1');
  });

  it('owner + protected note → content not returned', async () => {
    const userId = 'user-1';
    // Even if mongo says isProtected: false (stale), protectionPort is authoritative
    noteQueryDao.findUserNotes.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: false, content: 'fallback', createdAt: new Date(), updatedAt: new Date() }
    ]);
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set(['note-1']));
    
    const result = await handler.execute(new ListNotesQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(true);
    expect(result[0]!.content).toBe(''); // Content hidden!
    expect(documentSyncPort.readContent).not.toHaveBeenCalled(); // Should not even try reading Redis
  });
});
