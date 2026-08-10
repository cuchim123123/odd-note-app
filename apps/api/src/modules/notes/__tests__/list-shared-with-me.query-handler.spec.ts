import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListSharedWithMeQueryHandler } from '@modules/notes/application/queries/list-shared-with-me/list-shared-with-me.query-handler';
import { ListSharedWithMeQuery } from '@modules/notes/application/queries/list-shared-with-me/list-shared-with-me.query';

describe('ListSharedWithMeQueryHandler', () => {
  let handler: ListSharedWithMeQueryHandler;
  let noteQueryDao: any;
  let documentSyncPort: any;
  let protectionPort: any;

  beforeEach(() => {
    noteQueryDao = {
      findSharedWithMe: vi.fn(),
    };
    documentSyncPort = {
      readContent: vi.fn(),
    };
    protectionPort = {
      getProtectedNoteIds: vi.fn(),
    };

    handler = new ListSharedWithMeQueryHandler(
      noteQueryDao,
      documentSyncPort,
      protectionPort,
    );
  });

  it('shared user + unprotected note → content returned', async () => {
    const userId = 'user-1';
    noteQueryDao.findSharedWithMe.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: false, content: 'fallback', createdAt: new Date(), updatedAt: new Date(), sharedAt: new Date() }
    ]);
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set());
    documentSyncPort.readContent.mockResolvedValue('redis-content');

    const result = await handler.execute(new ListSharedWithMeQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(false);
    expect(result[0]!.content).toBe('redis-content');
    expect(documentSyncPort.readContent).toHaveBeenCalledWith('note-1');
  });

  it('shared user + protected note → content not returned', async () => {
    const userId = 'user-1';
    noteQueryDao.findSharedWithMe.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: false, content: 'fallback', createdAt: new Date(), updatedAt: new Date(), sharedAt: new Date() }
    ]);
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set(['note-1']));
    
    const result = await handler.execute(new ListSharedWithMeQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(true);
    expect(result[0]!.content).toBe(''); // Content hidden!
    expect(documentSyncPort.readContent).not.toHaveBeenCalled(); // Should not even try reading Redis
  });
});
