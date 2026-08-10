import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetNoteByIdQueryHandler } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query-handler';
import { GetNoteByIdQuery } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query';

describe('GetNoteByIdQueryHandler', () => {
  let handler: GetNoteByIdQueryHandler;
  let noteQueryDao: any;
  let documentSyncPort: any;
  let protectionPort: any;

  beforeEach(() => {
    noteQueryDao = {
      findNoteById: vi.fn(),
    };
    documentSyncPort = {
      readContent: vi.fn(),
    };
    protectionPort = {
      getProtectedNoteIds: vi.fn(),
      verifyUnlockToken: vi.fn(),
    };

    handler = new GetNoteByIdQueryHandler(
      noteQueryDao,
      documentSyncPort,
      protectionPort,
    );
  });

  it('owner + unprotected note → content returned', async () => {
    noteQueryDao.findNoteById.mockResolvedValue({ id: 'note-1', isProtected: false, createdAt: new Date(), updatedAt: new Date() });
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set());
    documentSyncPort.readContent.mockResolvedValue('redis-content');

    const result = await handler.execute(new GetNoteByIdQuery('user-1', 'note-1'));

    expect(result.content).toBe('redis-content');
    expect(result.isProtected).toBe(false);
  });

  it('owner + protected note + valid unlock authorization → content returned', async () => {
    noteQueryDao.findNoteById.mockResolvedValue({ id: 'note-1', isProtected: true, createdAt: new Date(), updatedAt: new Date() });
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set(['note-1']));
    protectionPort.verifyUnlockToken.mockResolvedValue(true);
    documentSyncPort.readContent.mockResolvedValue('redis-content');

    const result = await handler.execute(new GetNoteByIdQuery('user-1', 'note-1', 'valid-token'));

    expect(result.content).toBe('redis-content');
    expect(result.isProtected).toBe(true);
    expect(protectionPort.verifyUnlockToken).toHaveBeenCalledWith('user-1', 'note-1', 'valid-token');
  });

  it('owner + protected note + no unlock authorization → content not returned', async () => {
    noteQueryDao.findNoteById.mockResolvedValue({ id: 'note-1', isProtected: true, createdAt: new Date(), updatedAt: new Date() });
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set(['note-1']));
    protectionPort.verifyUnlockToken.mockResolvedValue(false);

    const result = await handler.execute(new GetNoteByIdQuery('user-1', 'note-1'));

    expect(result.content).toBe('');
    expect(result.isProtected).toBe(true);
  });

  it('owner + protected note + invalid/expired unlock token → content not returned', async () => {
    noteQueryDao.findNoteById.mockResolvedValue({ id: 'note-1', isProtected: true, createdAt: new Date(), updatedAt: new Date() });
    protectionPort.getProtectedNoteIds.mockResolvedValue(new Set(['note-1']));
    protectionPort.verifyUnlockToken.mockResolvedValue(false);

    const result = await handler.execute(new GetNoteByIdQuery('user-1', 'note-1', 'invalid-token'));

    expect(result.content).toBe('');
    expect(result.isProtected).toBe(true);
  });
});
