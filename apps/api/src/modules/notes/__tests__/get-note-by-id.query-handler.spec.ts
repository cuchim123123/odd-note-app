/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetNoteByIdQueryHandler } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query-handler';
import { GetNoteByIdQuery } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query';

describe('GetNoteByIdQueryHandler', () => {
  let handler: GetNoteByIdQueryHandler;
  let noteQueryDao: any;
  let documentSyncPort: any;

  beforeEach(() => {
    noteQueryDao = {
      findNoteById: vi.fn(),

    };
    documentSyncPort = {
      readContent: vi.fn(),
    };

    handler = new GetNoteByIdQueryHandler(
      noteQueryDao,
      documentSyncPort,
    );
  });

  it('owner + unprotected note → content returned', async () => {
    noteQueryDao.findNoteById.mockResolvedValue({ id: 'note-1', isProtected: false, createdAt: new Date(), updatedAt: new Date() });
    documentSyncPort.readContent.mockResolvedValue('redis-content');

    const result = await handler.execute(new GetNoteByIdQuery('user-1', 'note-1'));

    expect(result.content).toBe('redis-content');
    expect(result.isProtected).toBe(false);
  });

  it('owner + protected note → content still returned for offline sync', async () => {
    noteQueryDao.findNoteById.mockResolvedValue({ id: 'note-1', isProtected: true, createdAt: new Date(), updatedAt: new Date() });
    documentSyncPort.readContent.mockResolvedValue('redis-content');

    const result = await handler.execute(new GetNoteByIdQuery('user-1', 'note-1'));

    expect(result.content).toBe('redis-content');
    expect(result.isProtected).toBe(true);
  });
});
