import { ValueObject } from '@shared/domain/ddd/value-object';
import { InvalidNoteTitleError } from '@modules/notes/domain/errors/note.errors';

export interface NoteTitleProps {
  value: string;
}

export class NoteTitle extends ValueObject<NoteTitleProps> {
  private constructor(props: NoteTitleProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(title: string): NoteTitle {
    if (title === null || title === undefined) {
      throw new InvalidNoteTitleError('Note title cannot be null or undefined');
    }

    const trimmedTitle = title.trim();

    if (trimmedTitle.length === 0) {
      throw new InvalidNoteTitleError('Note title cannot be empty');
    }

    if (trimmedTitle.length > 500) {
      throw new InvalidNoteTitleError('Note title cannot exceed 500 characters');
    }

    return new NoteTitle({ value: trimmedTitle });
  }
}
