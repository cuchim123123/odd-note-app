import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NoteDashboard } from '../components/note-dashboard';
import { resetMockNotes } from '../api/notes.api';
import { renderWithQueryClient } from '../../../test/render-with-query-client';

describe('Optimistic updates (observable)', () => {
  beforeEach(() => {
    resetMockNotes();
  });

  it('shows newly created note immediately in the sidebar', async () => {
    renderWithQueryClient(<NoteDashboard />);

    const createBtn = screen.getAllByLabelText('Create new note')[0];
    await userEvent.click(createBtn);

    // The new note title should be visible in the list immediately
    await waitFor(() => {
      expect(screen.getAllByText(/Untitled Note/)[0]).toBeTruthy();
    });
  });

  it('toggles pin state optimistically in the UI', async () => {
    renderWithQueryClient(<NoteDashboard />);

    // ensure there's at least one note
    const createBtn = screen.getAllByLabelText('Create new note')[0];
    await userEvent.click(createBtn);

    // find the first note card and its pin button
    const card = await screen.findByText('Untitled Note');
    const cardContainer = card.closest('[role="button"]');
    expect(cardContainer).toBeTruthy();

    const pinButton = within(cardContainer as Element).getByLabelText(/Pin note|Unpin note/);

    // initial aria-pressed should be false (unpinned)
    expect(pinButton.getAttribute('aria-pressed')).toBe('false');

    // click to toggle pin; optimistic update should flip aria-pressed immediately
    await userEvent.click(pinButton);

    await waitFor(() => {
      expect(pinButton.getAttribute('aria-pressed')).toBe('true');
    });
  });
});
