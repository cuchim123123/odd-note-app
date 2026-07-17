import { Entity } from '@shared/domain/ddd/entity';
import { uuidv7 } from 'uuidv7';

export interface NotificationProps {
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  /**
   * Structured payload for the notification.
   * Clean DDD: Domain holds the object, Infrastructure handles serialization.
   */
  data: Record<string, unknown> | null;
  /** Source DomainEvent.eventId — used for idempotent notification creation. */
  eventId: string | null;
  createdAt: Date;
}

export class NotificationEntity extends Entity<NotificationProps> {
  get userId(): string { return this.props.userId; }
  get type(): string { return this.props.type; }
  get title(): string { return this.props.title; }
  get message(): string { return this.props.message; }
  get read(): boolean { return this.props.read; }
  /** Structured JSON data */
  get data(): Record<string, unknown> | null { return this.props.data; }
  get eventId(): string | null { return this.props.eventId; }
  get createdAt(): Date { return this.props.createdAt; }



  public markAsRead(): void {
    if (!this.props.read) {
      this.props.read = true;
    }
  }

  /**
   * Factory for new notifications.
   * @param data  Structured payload.
   */
  public static create(
    userId: string,
    type: string,
    title: string,
    message: string,
    data: Record<string, unknown> | null = null,
    eventId: string | null = null,
  ): NotificationEntity {
    return new NotificationEntity({
      userId,
      type,
      title,
      message,
      read: false,
      data,
      eventId,
      createdAt: new Date(),
    }, uuidv7());
  }

  /** Reconstitutes a notification from the DB row. */
  public static reconstitute(id: string, props: NotificationProps): NotificationEntity {
    return new NotificationEntity(props, id);
  }
}
