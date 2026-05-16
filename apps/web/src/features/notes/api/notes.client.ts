import { api } from '../../../lib/axios';
import type { Note, CreateNoteInput, UpdateNoteInput } from '@odd-note-app/validation';
import type { SharedNoteItem, NoteShareRecord } from './notes.api';

export async function fetchNotesFromApi(): Promise<Note[]> {
  const response = await api.get<Note[]>('/notes');
  return response.data;
}

export async function fetchNoteFromApi(id: string): Promise<Note> {
  const response = await api.get<Note>(`/notes/${id}`);
  return response.data;
}

export async function createNoteInApi(input: CreateNoteInput): Promise<Note> {
  const response = await api.post<Note>('/notes', input);
  return response.data;
}

export async function updateNoteInApi(id: string, input: UpdateNoteInput & { isProtected?: boolean }): Promise<Note> {
  const { isProtected, ...payload } = input;
  const response = await api.patch<Note>(`/notes/${id}`, payload);
  return { ...response.data, isProtected: isProtected ?? response.data.isProtected };
}

export async function deleteNoteInApi(id: string): Promise<void> {
  await api.delete(`/notes/${id}`);
}

export async function fetchSharedNotesFromApi(): Promise<SharedNoteItem[]> {
  const response = await api.get<SharedNoteItem[]>('/notes/shared-with-me');
  return response.data;
}

export async function fetchNoteSharesFromApi(noteId: string): Promise<NoteShareRecord[]> {
  const response = await api.get<NoteShareRecord[]>(`/notes/${noteId}/shares`);
  return response.data;
}

export async function createNoteShareInApi(noteId: string, input: { recipientEmail: string; permission: string }): Promise<NoteShareRecord> {
  const response = await api.post<NoteShareRecord>(`/notes/${noteId}/shares`, input);
  return response.data;
}

export async function updateNoteShareInApi(noteId: string, shareId: string, input: { permission: string }): Promise<NoteShareRecord> {
  const response = await api.patch<NoteShareRecord>(`/notes/${noteId}/shares/${shareId}`, input);
  return response.data;
}

export async function deleteNoteShareInApi(noteId: string, shareId: string): Promise<void> {
  await api.delete(`/notes/${noteId}/shares/${shareId}`);
}
