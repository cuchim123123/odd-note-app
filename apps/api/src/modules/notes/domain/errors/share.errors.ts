import { DomainError } from '../../../../common/domain/domain-error';

/**
 * Raised when the intended recipient of a note share does not exist.
 */
export class RecipientNotFoundError extends DomainError {
  constructor(email: string) {
    super(`Recipient with email '${email}' was not found`, 'RECIPIENT_NOT_FOUND');
  }
}

/**
 * Raised when a user attempts to share a note with themselves.
 */
export class SelfShareError extends DomainError {
  constructor() {
    super('You cannot share a note with yourself', 'SELF_SHARE_NOT_ALLOWED');
  }
}

/**
 * Raised when a share record with the given id does not exist on the note.
 */
export class ShareNotFoundError extends DomainError {
  constructor(shareId: string) {
    super(`Share record '${shareId}' was not found`, 'SHARE_NOT_FOUND');
  }
}
