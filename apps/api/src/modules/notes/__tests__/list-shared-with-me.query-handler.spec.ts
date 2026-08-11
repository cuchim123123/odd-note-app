/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListSharedWithMeQueryHandler } from '@modules/notes/application/queries/list-shared-with-me/list-shared-with-me.query-handler';
import { ListSharedWithMeQuery } from '@modules/notes/application/queries/list-shared-with-me/list-shared-with-me.query';

describe('ListSharedWithMeQueryHandler', () => {
  let handler: ListSharedWithMeQueryHandler;
  let noteQueryDao: any;
  let documentSyncPort: any;

  beforeEach(() => {
    noteQueryDao = {
      findSharedWithMe: vi.fn(),
    };
    documentSyncPort = {
      readContents: vi.fn(),
    };

    handler = new ListSharedWithMeQueryHandler(
      noteQueryDao,
      documentSyncPort,
    );
  });

  it('shared user + unprotected note → content returned', async () => {
    const userId = 'user-1';
    noteQueryDao.findSharedWithMe.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: false, createdAt: new Date(), updatedAt: new Date(), sharedAt: new Date() }
    ]);
    const mockMap = new Map();
    mockMap.set('note-1', 'redis-content');
    documentSyncPort.readContents.mockResolvedValue(mockMap);

    const result = await handler.execute(new ListSharedWithMeQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(false);
    expect(result[0]!.content).toBe('redis-content');
    expect(documentSyncPort.readContents).toHaveBeenCalledWith(['note-1']);
  });

  it('shared user + protected note → content returned for offline sync', async () => {
    const userId = 'user-1';
    noteQueryDao.findSharedWithMe.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: true, createdAt: new Date(), updatedAt: new Date(), sharedAt: new Date() }
    ]);
    const mockMap = new Map();
    mockMap.set('note-1', 'redis-content-protected');
    documentSyncPort.readContents.mockResolvedValue(mockMap);
    
    const result = await handler.execute(new ListSharedWithMeQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(true);
    expect(result[0]!.content).toBe('redis-content-protected');
    expect(documentSyncPort.readContents).toHaveBeenCalledWith(['note-1']);
  });
});
