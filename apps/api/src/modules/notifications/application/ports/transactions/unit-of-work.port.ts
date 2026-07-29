import type { INotificationRepository } from '@modules/notifications/application/ports/notification.repository.port';

export interface NotificationRepositories {
  notification: INotificationRepository;
}

export interface NotificationTransactionContext {
  repos: NotificationRepositories;
}

export interface INotificationUnitOfWork {
  execute<T>(work: (ctx: NotificationTransactionContext) => Promise<T>): Promise<T>;
}
export const NOTIFICATION_UNIT_OF_WORK = Symbol('NOTIFICATION_UNIT_OF_WORK');
