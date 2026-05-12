import { beforeEach, describe, expect, it } from 'vitest';

import { resetMockNotes, createNote, getNoteById } from '../../notes/api/notes.api';
import { useLabelManagementStore } from '../stores/label-management.store';

describe('Label management store', () => {
  beforeEach(() => {
    resetMockNotes();
    useLabelManagementStore.setState({ labels: [] });
  });

  it('adds and persists labels for the filter list', () => {
    useLabelManagementStore.getState().addLabel('project');

    expect(useLabelManagementStore.getState().labels).toContain('project');
  });

  it('renames labels across notes and the registry', () => {
    const created = createNote({ title: 'Tracked', content: '', labels: ['work'] });
    useLabelManagementStore.getState().syncLabels(['work']);

    useLabelManagementStore.getState().renameLabel('work', 'team');

    expect(useLabelManagementStore.getState().labels).toContain('team');
    expect(useLabelManagementStore.getState().labels).not.toContain('work');
    expect(getNoteById(created.id).labels).toContain('team');
  });

  it('deletes labels without removing them from notes', () => {
    const created = createNote({ title: 'Keep label', content: '', labels: ['archive'] });
    useLabelManagementStore.getState().syncLabels(['archive']);

    useLabelManagementStore.getState().deleteLabel('archive');

    expect(useLabelManagementStore.getState().labels).not.toContain('archive');
    expect(getNoteById(created.id).labels).toContain('archive');
  });
});
