export class CreateNotificationCommand {
  constructor(
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string,
    public readonly message: string,
    public readonly data?: Record<string, unknown>,
    /** Source DomainEvent.eventId — prevents duplicate notifications on Kafka redelivery. */
    public readonly eventId?: string,
  ) {}
}
