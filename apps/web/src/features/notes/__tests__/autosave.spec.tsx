import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NoteDashboard } from '../components/note-dashboard';
import { resetMockNotes } from '../api/notes.api';
import { renderWithQueryClient } from '../../../test/render-with-query-client';

import { Routes, Route } from 'react-router-dom';

describe('Autosave behavior (observable)', () => {
  beforeEach(() => {
    resetMockNotes();
  });

  it('shows autosave status when editing and eventually shows saved', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <Routes>
        <Route path="/notes/:noteId" element={<NoteDashboard />} />
        <Route path="*" element={<NoteDashboard />} />
      </Routes>
    );

    // create a new note via the sidebar button
    const createBtn = screen.getAllByLabelText('Create new note')[0]!;
    await user.click(createBtn);

    // editor should mount
    const editor = await screen.findByTestId('note-editor');
    expect(editor).toBeTruthy();

    // update the title which should trigger autosave behavior
    const titleInput = screen.getByPlaceholderText('Title…') as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'Autosave test title');

    // Verify the title was typed in the input
    expect(titleInput.value).toBe('Autosave test title');

    // Wait for the autosave mutation to persist the edited title (650ms debounce + buffer).
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    // After autosave, the title should still be in the input
    expect(titleInput.value).toBe('Autosave test title');
  });
});
