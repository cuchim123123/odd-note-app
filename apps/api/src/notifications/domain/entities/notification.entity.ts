import { Entity } from '../../../common/ddd/entity';

export interface NotificationProps {
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  /**
   * Serialized JSON payload for the notification.
   * Kept as string|null in props because this is what the DB stores and what
   * the mapper reconstitutes from. Serialization is done once in create().
   */
  data: string | null;
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
  /** Raw JSON string for persistence. Use parsedData() for typed access. */
  get data(): string | null { return this.props.data; }
  get eventId(): string | null { return this.props.eventId; }
  get createdAt(): Date { return this.props.createdAt; }

  /**
   * Returns the parsed notification payload as a typed object.
   * Returns null if no data was provided at creation time.
   */
  public parsedData(): Record<string, unknown> | null {
    if (!this.props.data) return null;
    try {
      return JSON.parse(this.props.data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  public markAsRead(): void {
    if (!this.props.read) {
      this.props.read = true;
    }
  }

  /**
   * Factory for new notifications.
   * @param data  Structured payload — serialized to JSON internally.
   *              Callers never deal with raw JSON strings.
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
      data: data !== null ? JSON.stringify(data) : null,
      eventId,
      createdAt: new Date(),
    }, crypto.randomUUID());
  }

  /** Reconstitutes a notification from the DB row — data is already a JSON string. */
  public static reconstitute(id: string, props: NotificationProps): NotificationEntity {
    return new NotificationEntity(props, id);
  }
}
