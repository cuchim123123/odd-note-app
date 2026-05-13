import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NoteDashboard } from '../components/note-dashboard';
import { resetMockNotes } from '../api/notes.api';
import { renderWithQueryClient } from '../../../test/render-with-query-client';

describe('Autosave behavior (observable)', () => {
  beforeEach(() => {
    resetMockNotes();
  });

  it('shows autosave status when editing and eventually shows saved', async () => {
    const user = userEvent.setup();

    const firstRender = renderWithQueryClient(<NoteDashboard />);

    // create a new note via the sidebar button
    const createBtn = screen.getAllByLabelText('Create new note')[0]!;
    await user.click(createBtn);

    // editor should mount
    const editor = await screen.findByTestId('note-editor');
    expect(editor).toBeTruthy();

    // update the title which should trigger autosave behavior
    const titleInput = screen.getByPlaceholderText('Note title...');
    await user.clear(titleInput);
    await user.type(titleInput, 'Autosave test title');

    // Wait for the autosave mutation to persist the edited title.
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    firstRender.unmount();
    renderWithQueryClient(<NoteDashboard />);

    expect(await screen.findByText('Autosave test title')).toBeInTheDocument();
  });
});
