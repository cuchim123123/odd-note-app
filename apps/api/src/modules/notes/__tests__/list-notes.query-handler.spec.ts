/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListNotesQueryHandler } from '@modules/notes/application/queries/list-notes/list-notes.query-handler';
import { ListNotesQuery } from '@modules/notes/application/queries/list-notes/list-notes.query';

describe('ListNotesQueryHandler', () => {
  let handler: ListNotesQueryHandler;
  let noteQueryDao: any;
  let documentSyncPort: any;

  beforeEach(() => {
    noteQueryDao = {
      findUserNotes: vi.fn(),
    };
    documentSyncPort = {
      readContents: vi.fn(),
    };

    handler = new ListNotesQueryHandler(
      noteQueryDao,
      documentSyncPort,
    );
  });

  it('owner + unprotected note → content returned', async () => {
    const userId = 'user-1';
    noteQueryDao.findUserNotes.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: false, createdAt: new Date(), updatedAt: new Date() }
    ]);
    const mockMap = new Map();
    mockMap.set('note-1', 'redis-content');
    documentSyncPort.readContents.mockResolvedValue(mockMap);

    const result = await handler.execute(new ListNotesQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(false);
    expect(result[0]!.content).toBe('redis-content');
    expect(documentSyncPort.readContents).toHaveBeenCalledWith(['note-1']);
  });

  it('owner + protected note → content returned for offline sync', async () => {
    const userId = 'user-1';
    noteQueryDao.findUserNotes.mockResolvedValue([
      { id: 'note-1', title: 'Note 1', isProtected: true, createdAt: new Date(), updatedAt: new Date() }
    ]);
    const mockMap = new Map();
    mockMap.set('note-1', 'redis-content-protected');
    documentSyncPort.readContents.mockResolvedValue(mockMap);
    
    const result = await handler.execute(new ListNotesQuery(userId));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('note-1');
    expect(result[0]!.isProtected).toBe(true);
    expect(result[0]!.content).toBe('redis-content-protected'); // Content is sent for offline sync
    expect(documentSyncPort.readContents).toHaveBeenCalledWith(['note-1']);
  });
});
