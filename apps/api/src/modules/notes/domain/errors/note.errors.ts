import { DomainError } from '@shared/domain/errors/domain-error';

export class NoteNotFoundError extends DomainError {
  constructor(noteId: string) {
    super(`Note with ID ${noteId} not found`, 'NOTE_NOT_FOUND');
  }
}

export class NotePermissionDeniedError extends DomainError {
  constructor(message: string = 'You do not have permission to access this note') {
    super(message, 'NOTE_PERMISSION_DENIED');
  }
}

export class NoteAlreadySharedError extends DomainError {
  constructor() {
    super(`Note is already shared to this user`, 'NOTE_ALREADY_SHARED');
  }
}

export class InvalidNoteTitleError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_NOTE_TITLE');
  }
}

export class IncorrectPasswordError extends DomainError {
  constructor() {
    super('The provided password is incorrect', 'INCORRECT_PASSWORD');
  }
}
