import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NoteDashboard } from '../components/note-dashboard';
import * as notesApi from '../api/notes.api';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { renderWithQueryClient } from '../../../test/render-with-query-client';

import { Routes, Route } from 'react-router-dom';

describe('Note protection behavior', () => {
  beforeEach(() => {
    notesApi.resetMockNotes();
    useNoteProtectionStore.getState().resetProtectionState();
    vi.restoreAllMocks();
  });

  it('blocks note content until the password is entered', async () => {
    const user = userEvent.setup();
    const note = notesApi.getSortedNotes()[0]!;

    notesApi.updateNote(note.id || '', { isProtected: true });

    vi.spyOn(notesApi, 'getNoteProtectionStatus').mockResolvedValue({ isProtected: true });
    vi.spyOn(notesApi, 'verifyNotePassword').mockImplementation(async (_noteId, password) => {
      return { verified: password === 'secret123' };
    });

    renderWithQueryClient(
      <Routes>
        <Route path="/notes/:noteId" element={<NoteDashboard />} />
        <Route path="*" element={<NoteDashboard />} />
      </Routes>
    );

    await user.click(await screen.findByText(note.title || ''));

    expect(await screen.findByText('Protected')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('Wrong password.')).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Password'));
    await user.type(screen.getByPlaceholderText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByPlaceholderText('Title…')).toBeInTheDocument();
  });
});
