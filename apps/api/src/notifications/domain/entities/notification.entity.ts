import { Entity } from '../../../common/ddd/entity';

export interface NotificationProps {
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: string | null;
  createdAt: Date;
}

export class NotificationEntity extends Entity<NotificationProps> {
  get userId(): string { return this.props.userId; }
  get type(): string { return this.props.type; }
  get title(): string { return this.props.title; }
  get message(): string { return this.props.message; }
  get read(): boolean { return this.props.read; }
  get data(): string | null { return this.props.data; }
  get createdAt(): Date { return this.props.createdAt; }

  public markAsRead(): void {
    if (!this.props.read) {
      this.props.read = true;
    }
  }

  public static create(
    userId: string,
    type: string,
    title: string,
    message: string,
    data: string | null = null,
  ): NotificationEntity {
    return new NotificationEntity({
      userId,
      type,
      title,
      message,
      read: false,
      data,
      createdAt: new Date(),
    }, crypto.randomUUID());
  }

  public static reconstitute(id: string, props: NotificationProps): NotificationEntity {
    return new NotificationEntity(props, id);
  }
}
