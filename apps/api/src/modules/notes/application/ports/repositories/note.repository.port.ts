import { NoteEntity } from '@modules/notes/domain/entities/note.entity';

export const NOTE_REPOSITORY = Symbol('NOTE_REPOSITORY');

export interface INoteRepository {
  create(note: NoteEntity): Promise<void>;
  update(note: NoteEntity): Promise<void>;
  findById(id: string): Promise<NoteEntity | null>;
  delete(note: NoteEntity): Promise<void>;
}
