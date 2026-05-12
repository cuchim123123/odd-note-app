import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NoteDashboard } from '../components/note-dashboard';
import { getSortedNotes, updateNote, resetMockNotes } from '../api/notes.api';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import { renderWithQueryClient } from '../../../test/render-with-query-client';

describe('Note protection behavior', () => {
  beforeEach(() => {
    resetMockNotes();
    useNoteProtectionStore.getState().resetProtectionState();
  });

  it('blocks note content until the password is entered', async () => {
    const user = userEvent.setup();
    const note = getSortedNotes()[0];

    updateNote(note.id, { isProtected: true });
    useNoteProtectionStore.getState().lockNote(note.id, 'secret123');

    renderWithQueryClient(<NoteDashboard />);

    await user.click(await screen.findByText(note.title));

    expect(await screen.findByText('This note is protected')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Unlock note' }));

    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Unlock note' }));

    expect(await screen.findByPlaceholderText('Note title...')).toBeInTheDocument();
  });
});
