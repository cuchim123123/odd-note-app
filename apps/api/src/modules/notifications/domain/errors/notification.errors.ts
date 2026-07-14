import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class NotificationNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Notification with id ${id} not found`, 'NOTIFICATION_NOT_FOUND');
  }
}

export class NotificationPermissionDeniedError extends DomainError {
  constructor() {
    super('You do not own this notification', 'NOTIFICATION_PERMISSION_DENIED');
  }
}
