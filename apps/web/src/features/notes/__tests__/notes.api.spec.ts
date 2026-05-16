import { describe, it, expect, beforeEach } from 'vitest';
import { resetMockNotes, createNote, getSortedNotes, getNoteById, updateNote, deleteNote } from '../api/notes.api';

describe('Notes API — in-memory mock behavior', () => {
  beforeEach(() => {
    resetMockNotes();
  });

  describe('creating a note', () => {
    it('should be retrievable from the notes list afterward', () => {
      const created = createNote({ title: 'My Note', content: '<p>content</p>' });
      const allNotes = getSortedNotes();
      
      expect(allNotes.some((n) => n.id === (created.id || ''))).toBe(true);
      expect(allNotes.some((n) => n.title === 'My Note')).toBe(true);
    });

    it('should have the provided title and content', () => {
      const created = createNote({ title: 'Test Note', content: '<p>body</p>' });
      
      expect(created.title).toBe('Test Note');
      expect(created.content).toBe('<p>body</p>');
    });
  });

  describe('retrieving a note by ID', () => {
    it('should return the exact note when it exists', () => {
      const created = createNote({ title: 'Findable', content: 'data' });
      const fetched = getNoteById(created.id || '');
      
      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe('Findable');
    });

    it('should raise an error when the note does not exist', () => {
      expect(() => getNoteById('nonexistent-id')).toThrow('Note not found');
    });
  });

  describe('updating a note', () => {
    it('should change the requested fields', () => {
      const created = createNote({ title: 'Original', content: 'old content' });
      const updated = updateNote(created.id || '', { title: 'Changed' });
      
      expect(updated.title).toBe('Changed');
    });

    it('should preserve fields that are not updated', () => {
      const created = createNote({ title: 'Start', content: 'keep this' });
      const updated = updateNote(created.id || '', { title: 'End' });
      
      expect(updated.content).toBe('keep this');
    });

    it('should be reflected in future retrievals', () => {
      const created = createNote({ title: 'Before', content: '' });
      updateNote(created.id || '', { title: 'After' });
      const fetched = getNoteById(created.id || '');
      
      expect(fetched.title).toBe('After');
    });
  });

  describe('deleting a note', () => {
    it('should remove it from the notes list', () => {
      const created = createNote({ title: 'Disposable', content: '' });
      deleteNote(created.id || '');
      const allNotes = getSortedNotes();
      
      expect(allNotes.some((n) => n.id === (created.id || ''))).toBe(false);
    });

    it('should cause subsequent retrieval to fail', () => {
      const created = createNote({ title: 'Temporary', content: '' });
      deleteNote(created.id || '');
      
      expect(() => getNoteById(created.id || '')).toThrow('Note not found');
    });
  });
});
